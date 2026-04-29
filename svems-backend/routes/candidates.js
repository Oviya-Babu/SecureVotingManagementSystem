// ============================================================
// routes/candidates.js — Candidate Listing
// GET /api/candidates?constituencyID=X
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// ─────────────────────────────────────────────
// GET /api/candidates?constituencyID=X
// Returns candidate list for a constituency
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { constituencyID } = req.query;
  const electionID = req.query.electionID || 1;

  console.log(`[CANDIDATES] Fetching candidates for ConstituencyID=${constituencyID}`);

  if (!constituencyID) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'constituencyID query parameter is required.'
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT c.CandidateID, c.CandidateName, c.AgeAtElection, c.Education, c.IsNOTA,
              pp.PartyID, pp.PartyCode, pp.PartyName, pp.PartySymbol,
              con.ConstituencyName
       FROM Candidate c
       JOIN PoliticalParty pp ON c.PartyID = pp.PartyID
       JOIN Constituency con ON c.ConstituencyID = con.ConstituencyID
       WHERE c.ConstituencyID = ? AND c.ElectionID = ?
       ORDER BY c.IsNOTA ASC, c.CandidateID ASC`,
      [constituencyID, electionID]
    );

    console.log(`[CANDIDATES] ✅ Found ${rows.length} candidates`);

    return res.json({
      success: true,
      constituencyID: parseInt(constituencyID),
      constituencyName: rows.length > 0 ? rows[0].ConstituencyName : '',
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
