// ============================================================
// routes/candidates.js — Candidate Listing
// GET /api/candidates?constituencyID=X&electionID=1
// FIX: Added AND c.ElectionID = ? to prevent cross-election data leakage
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  const { constituencyID } = req.query;
  const electionID = parseInt(req.query.electionID) || 1;

  console.log(`[CANDIDATES] Fetching for ConstituencyID=${constituencyID}, ElectionID=${electionID}`);

  if (!constituencyID || isNaN(parseInt(constituencyID))) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'constituencyID query parameter is required.'
    });
  }

  try {
    // FIX (ROOT CAUSE C): Added AND c.ElectionID = ? — without this, candidates from ALL
    // elections leak into the ballot if the DB has multi-election data.
    const [rows] = await db.query(
      `SELECT c.CandidateID, c.CandidateName, c.AgeAtElection, c.Education, c.IsNOTA,
              pp.PartyCode, pp.PartyName,
              con.ConstituencyName
       FROM Candidate c
       JOIN PoliticalParty pp ON c.PartyID = pp.PartyID
       JOIN Constituency con ON c.ConstituencyID = con.ConstituencyID
       WHERE c.ConstituencyID = ? AND c.ElectionID = ?
       ORDER BY c.IsNOTA ASC, c.CandidateID ASC`,
      [parseInt(constituencyID), electionID]
    );

    console.log(`[CANDIDATES] ✅ Found ${rows.length} candidates`);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'NO_CANDIDATES',
        message: 'No candidates found for this constituency.'
      });
    }

    return res.json({
      success: true,
      constituencyID: parseInt(constituencyID),
      constituencyName: rows[0].ConstituencyName || '',
      electionID,
      candidates: rows
    });

  } catch (err) {
    console.error('[CANDIDATES] ❌ Error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to fetch candidates.'
    });
  }
});

module.exports = router;
