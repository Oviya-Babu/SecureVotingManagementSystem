// ============================================================
// routes/results.js — Election Results Routes
// /live    — always available (ticker, no closed gate)
// /status  — always available (election status + live counts)
// /summary, /final, /constituency, /winners — Closed only
// ============================================================
const express = require('express');
const router = express.Router();
const readPool = require('../db-read');

// ── LIVE ticker — always available ──────────────────────────
router.get('/live', async (req, res) => {
  try {
    const [tv] = await readPool.query('SELECT COUNT(*) AS total FROM Vote WHERE ElectionID=1');
    const [tr] = await readPool.query('SELECT COUNT(*) AS total FROM Voter WHERE IsActive=1');
    const [pt] = await readPool.query(
      `SELECT pp.PartyCode, pp.PartyName, COUNT(v.VoteID) AS votes,
        SUM(CASE WHEN r.IsWinner=1 THEN 1 ELSE 0 END) AS seats
       FROM PoliticalParty pp
       LEFT JOIN Candidate c ON pp.PartyID=c.PartyID AND c.ElectionID=1
       LEFT JOIN Vote v ON c.CandidateID=v.CandidateID AND v.ElectionID=1
       LEFT JOIN Result r ON c.CandidateID=r.CandidateID AND r.ElectionID=1
       WHERE pp.PartyCode!='NOTA'
       GROUP BY pp.PartyID, pp.PartyCode, pp.PartyName
       ORDER BY seats DESC, votes DESC`
    );
    const total = tv[0].total, voters = tr[0].total;
    res.json({
      success: true,
      totalVotes: total,
      totalVoters: voters,
      turnout: voters > 0 ? ((total / voters) * 100).toFixed(2) : '0.00',
      partyTally: pt,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[RESULTS] /live error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load live data.' });
  }
});

// ── STATUS — always available (election state + live totals) ─
router.get('/status', async (req, res) => {
  try {
    const [electionRows] = await readPool.query(
      'SELECT Status, ElectionName FROM Election WHERE ElectionID = 1'
    );
    const election = electionRows[0] || { Status: 'Unknown', ElectionName: 'Election' };

    const [tv] = await readPool.query('SELECT COUNT(*) AS total FROM Vote WHERE ElectionID=1');
    const [tr] = await readPool.query('SELECT COUNT(*) AS total FROM Voter WHERE IsActive=1');
    const [pt] = await readPool.query(
      `SELECT pp.PartyCode, pp.PartyName, COUNT(v.VoteID) AS votes
       FROM PoliticalParty pp
       LEFT JOIN Candidate c ON pp.PartyID=c.PartyID AND c.ElectionID=1
       LEFT JOIN Vote v ON c.CandidateID=v.CandidateID AND v.ElectionID=1
       WHERE pp.PartyCode!='NOTA'
       GROUP BY pp.PartyID, pp.PartyCode, pp.PartyName
       ORDER BY votes DESC`
    );
    const total = tv[0].total, voters = tr[0].total;

    // FIX (ROOT CAUSE D): Detect tie at the top before reporting leadingParty
    let leadingParty = '—';
    if (pt.length > 0 && pt[0].votes > 0) {
      if (pt.length > 1 && pt[0].votes === pt[1].votes) {
        leadingParty = 'TIE';
      } else {
        leadingParty = pt[0].PartyCode;
      }
    }

    res.json({
      success: true,
      electionStatus: election.Status,
      electionName: election.ElectionName,
      totalVotes: total,
      totalVoters: voters,
      turnout: voters > 0 ? ((total / voters) * 100).toFixed(2) : '0.00',
      leadingParty,
      partyTally: pt,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[RESULTS] /status error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load status.' });
  }
});

// ── Gate: remaining routes require election to be Closed ────
router.use(async (req, res, next) => {
  try {
    const [rows] = await readPool.query('SELECT Status FROM Election WHERE ElectionID = 1');
    if (rows.length === 0 || rows[0].Status !== 'Closed') {
      return res.status(403).json({
        success: false,
        code: 'ELECTION_NOT_CLOSED',
        message: 'Results are only available after the election has been completed.'
      });
    }
    next();
  } catch (err) {
    console.error('[RESULTS] Status check error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Summary ─────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const [tv] = await readPool.query('SELECT COUNT(*) AS total FROM Vote WHERE ElectionID=1');
    const [tr] = await readPool.query('SELECT COUNT(*) AS total FROM Voter WHERE IsActive=1');
    const [sd] = await readPool.query('SELECT COUNT(*) AS total FROM Result WHERE ElectionID=1 AND IsWinner=1');
    let wp = 'N/A';
    try { const [w] = await readPool.query('SELECT fn_GetWinningParty(1) AS wp'); wp = w[0].wp; } catch (e) {}
    const total = tv[0].total, voters = tr[0].total;
    res.json({
      success: true,
      totalVotesCast: total,
      totalRegisteredVoters: voters,
      turnoutPercentage: voters > 0 ? parseFloat(((total / voters) * 100).toFixed(2)) : 0,
      seatsDecided: sd[0].total,
      totalSeats: 36,
      winningParty: wp
    });
  } catch (err) {
    console.error('[RESULTS] /summary error:', err.message);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

// ── Final (via SP) ───────────────────────────────────────────
router.get('/final', async (req, res) => {
  try {
    const [rows] = await readPool.query('CALL sp_GetFinalResults(1)');
    res.json({ success: true, results: Array.isArray(rows[0]) ? rows[0] : rows });
  } catch (err) {
    console.error('[RESULTS] /final error:', err.message);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

// ── Per-constituency breakdown ───────────────────────────────
router.get('/constituency', async (req, res) => {
  try {
    const [rows] = await readPool.query(
      'SELECT * FROM vw_constituencyresults ORDER BY ConstituencyID, TotalVotes DESC'
    );
    res.json({ success: true, results: rows });
  } catch (err) {
    console.error('[RESULTS] /constituency error:', err.message);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

// ── Winners list ─────────────────────────────────────────────
router.get('/winners', async (req, res) => {
  try {
    const [rows] = await readPool.query(
      `SELECT con.ConstituencyName, c.CandidateName AS WinnerName,
              pp.PartyCode, pp.PartyName, r.TotalVotes AS WinningVotes
       FROM Result r
       JOIN Candidate c  ON r.CandidateID  = c.CandidateID
       JOIN PoliticalParty pp ON c.PartyID = pp.PartyID
       JOIN Constituency con  ON r.ConstituencyID = con.ConstituencyID
       WHERE r.ElectionID = 1 AND r.IsWinner = 1
       ORDER BY con.ConstituencyName`
    );
    res.json({ success: true, winners: rows });
  } catch (err) {
    console.error('[RESULTS] /winners error:', err.message);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

module.exports = router;
