// ============================================================
// routes/vote.js — Vote Casting Route
// POST /api/vote/cast — Transaction + Row-Level Locking
// Three-layer duplicate prevention:
//   L1: UNIQUE constraint on Vote(VoterID, ElectionID)
//   L2: sp_CastVote stored procedure check
//   L3: SELECT FOR UPDATE transaction pre-check
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateReceiptHash } = require('../services/cryptoService');
const { validateVote } = require('../middleware/validateInput');
const { voteLimiter } = require('../middleware/rateLimiter');

router.use(voteLimiter);

// ─────────────────────────────────────────────
// POST /api/vote/cast
// Critical section with pessimistic row-level locking
// ─────────────────────────────────────────────
router.post('/cast', validateVote, async (req, res) => {
  const { voterID, candidateID, electionID } = req.body;
  console.log(`[VOTE] Cast request: VoterID=${voterID}, CandidateID=${candidateID}, ElectionID=${electionID}`);

  let conn;
  try {
    // Get dedicated connection for transaction
    conn = await db.getConnection();
    await conn.beginTransaction();
    console.log('[VOTE] Transaction BEGIN');

    // ── Layer 3: Row-level lock on Voter ──
    const [voterRows] = await conn.query(
      'SELECT VoterID, VoterName, ConstituencyID, IsActive FROM Voter WHERE VoterID = ? FOR UPDATE',
      [voterID]
    );

    if (voterRows.length === 0) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        code: 'VOTER_NOT_FOUND',
        message: 'Voter account not found or inactive.'
      });
    }

    const voter = voterRows[0];

    if (!voter.IsActive) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        code: 'VOTER_INACTIVE',
        message: 'This voter account has been deactivated.'
      });
    }

    // ── Layer 3: Check duplicate inside transaction lock ──
    const [existingVote] = await conn.query(
      'SELECT VoteID FROM Vote WHERE VoterID = ? AND ElectionID = ? FOR UPDATE',
      [voterID, electionID]
    );

    if (existingVote.length > 0) {
      await conn.rollback();
      console.log(`[VOTE] ❌ Duplicate blocked (Layer 3) for VoterID=${voterID}`);
      return res.status(403).json({
        success: false,
        code: 'ALREADY_VOTED',
        message: 'Vote already recorded. Duplicate voting is not allowed.'
      });
    }

    // ── Validate candidate belongs to voter's constituency ──
    const [candRows] = await conn.query(
      'SELECT CandidateID, ConstituencyID, IsNOTA FROM Candidate WHERE CandidateID = ? AND ElectionID = ?',
      [candidateID, electionID]
    );

    if (candRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        code: 'CANDIDATE_NOT_FOUND',
        message: 'Candidate not found for this election.'
      });
    }

    if (candRows[0].ConstituencyID !== voter.ConstituencyID) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        code: 'CONSTITUENCY_MISMATCH',
        message: 'You can only vote for candidates in your registered constituency.'
      });
    }

    const isNOTA = candRows[0].IsNOTA;

    // ── Call sp_CastVote stored procedure (Layer 2) ──
    // Live SP takes exactly 3 IN parameters
    let voteID;
    try {
      await conn.query('CALL sp_CastVote(?, ?, ?)', [voterID, candidateID, electionID]);
      // Get the last inserted VoteID
      const [lastId] = await conn.query('SELECT LAST_INSERT_ID() AS voteID');
      voteID = lastId[0].voteID;
    } catch (spError) {
      // Handle SP SIGNAL errors (ALREADY_VOTED, CONSTITUENCY_MISMATCH, etc.)
      if (spError.sqlState === '45000') {
        await conn.rollback();
        const code = spError.message.split(':')[0] || 'VOTE_REJECTED';
        return res.status(403).json({
          success: false,
          code: code.trim(),
          message: spError.message
        });
      }
      // Check for duplicate key error (Layer 1: UNIQUE constraint)
      if (spError.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        console.log(`[VOTE] ❌ Duplicate blocked (Layer 1 UNIQUE) for VoterID=${voterID}`);
        return res.status(403).json({
          success: false,
          code: 'ALREADY_VOTED',
          message: 'Vote already recorded. Duplicate voting is not allowed.'
        });
      }
      throw spError;
    }

    // ── Commit transaction ──
    await conn.commit();

    // Generate receipt
    const { hash: receiptHash, timestamp } = generateReceiptHash(voterID, candidateID, electionID);

    console.log(`[VOTE] ✅ Vote cast successfully: VoteID=${voteID}, VoterID=${voterID}`);

    return res.json({
      success: true,
      code: 'VOTE_CAST',
      voteID: voteID,
      receiptHash: receiptHash,
      timestamp: timestamp,
      message: 'Your vote has been recorded successfully.'
    });

  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* rollback failed */ }
    }
    console.error('[VOTE] ❌ Vote casting error:', err.message);

    // Handle known SIGNAL errors from triggers/SP
    if (err.message.includes('ALREADY_VOTED')) {
      return res.status(403).json({
        success: false,
        code: 'ALREADY_VOTED',
        message: 'Vote already recorded. Duplicate voting is not allowed.'
      });
    }

    if (err.message.includes('VOTE_IMMUTABLE')) {
      return res.status(403).json({
        success: false,
        code: 'VOTE_IMMUTABLE',
        message: 'Votes cannot be modified after casting.'
      });
    }

    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error. Please try again in a moment.'
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
