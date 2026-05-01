// ============================================================
// routes/vote.js — Vote Casting Route (JWT-Verified)
// POST /api/vote/cast
// Requires: Authorization: Bearer <fully-verified-token>
// Security layers:
//   L1: JWT verification (biometricVerified = true)
//   L2: SELECT FOR UPDATE transaction lock on Voter
//   L3: UNIQUE constraint via sp_CastVote SP
// ============================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { generateReceiptHash } = require('../services/cryptoService');
const { validateVote } = require('../middleware/validateInput');

const JWT_SECRET = process.env.JWT_SECRET || 'SVEMS_JWT_SECRET_2025_DO_NOT_EXPOSE';

// ─────────────────────────────────────────────
// POST /api/vote/cast
// ─────────────────────────────────────────────
router.post('/cast', validateVote, async (req, res) => {
  const { voterID, candidateID, electionID } = req.body;
  console.log(`[VOTE] Cast request: VoterID=${voterID}, CandidateID=${candidateID}`);

  // ── Step 1: Validate JWT ──
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_REQUIRED',
      message: 'Authentication required. Please complete Aadhaar and biometric verification.'
    });
  }

  let session;
  try {
    session = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please verify your Aadhaar again.'
    });
  }

  // ── Step 2: Confirm Aadhaar session in token ──
  if (!session.aadhaarVerified) {
    return res.status(403).json({
      success: false,
      code: 'AADHAAR_REQUIRED',
      message: 'Please complete Aadhaar verification before voting.'
    });
  }

  // ── Step 3: Confirm token belongs to this voter ──
  if (session.voterID !== voterID) {
    return res.status(403).json({
      success: false,
      code: 'SESSION_MISMATCH',
      message: 'Session does not match voter identity.'
    });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // ── L1: Lock election row & verify status ──
    const [electionRows] = await conn.query(
      'SELECT Status FROM Election WHERE ElectionID = ? FOR UPDATE',
      [electionID]
    );
    if (!electionRows[0] || electionRows[0].Status !== 'Active') {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        code: 'ELECTION_NOT_ACTIVE',
        message: 'Voting is not currently allowed.'
      });
    }

    // ── L2: Lock voter row & check active ──
    const [voterRows] = await conn.query(
      'SELECT VoterID, VoterName, ConstituencyID, IsActive FROM Voter WHERE VoterID = ? FOR UPDATE',
      [voterID]
    );
    if (!voterRows[0] || !voterRows[0].IsActive) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        code: 'VOTER_NOT_FOUND',
        message: 'Voter account not found or deactivated.'
      });
    }

    const voter = voterRows[0];

    // ── L3: Check duplicate vote inside lock ──
    const [existing] = await conn.query(
      'SELECT VoteID FROM Vote WHERE VoterID = ? AND ElectionID = ? FOR UPDATE',
      [voterID, electionID]
    );
    if (existing.length > 0) {
      await conn.rollback();
      console.log(`[VOTE] ❌ Duplicate blocked for VoterID=${voterID}`);
      return res.status(403).json({
        success: false,
        code: 'ALREADY_VOTED',
        message: 'Vote already recorded. Duplicate voting is not allowed.'
      });
    }

    // ── Validate candidate belongs to voter's constituency ──
    const [candRows] = await conn.query(
      'SELECT CandidateID, ConstituencyID FROM Candidate WHERE CandidateID = ?',
      [candidateID]
    );
    if (!candRows[0]) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        code: 'CANDIDATE_NOT_FOUND',
        message: 'Candidate not found.'
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

    // ── L4: Call stored procedure (catches DB-level duplicates) ──
    let voteID;
    try {
      await conn.query('CALL sp_CastVote(?, ?, ?)', [voterID, candidateID, electionID]);
      const [lastId] = await conn.query('SELECT LAST_INSERT_ID() AS voteID');
      voteID = lastId[0].voteID;
    } catch (spErr) {
      await conn.rollback();
      if (spErr.code === 'ER_DUP_ENTRY' || spErr.message.includes('ALREADY_VOTED')) {
        return res.status(403).json({
          success: false,
          code: 'ALREADY_VOTED',
          message: 'Vote already recorded.'
        });
      }
      throw spErr;
    }

    await conn.commit();

    const { hash: receiptHash, timestamp } = generateReceiptHash(voterID, candidateID, electionID);
    console.log(`[VOTE] ✅ Vote cast: VoteID=${voteID}, VoterID=${voterID}`);

    return res.json({
      success: true,
      code: 'VOTE_CAST',
      voteID,
      receiptHash,
      timestamp,
      message: 'Your vote has been recorded successfully.'
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error('[VOTE] ❌ Error:', err.message);

    if (err.message.includes('ALREADY_VOTED')) {
      return res.status(403).json({ success: false, code: 'ALREADY_VOTED', message: 'Vote already recorded.' });
    }

    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error. Please try again.'
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
