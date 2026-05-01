// ============================================================
// routes/admin.js — Admin Panel Routes
// Uses ADMIN pool for simulation/reset operations
// ============================================================

const express = require('express');
const router = express.Router();
const adminPool = require('../db-admin');
const readPool = require('../db-read');

// POST /api/admin/simulate — Run bulk vote simulation
router.post('/simulate', async (req, res) => {
  const electionID = req.body.electionID || 1;
  console.log(`[ADMIN] Running simulation for ElectionID=${electionID}`);
  try {
    await adminPool.query('CALL sp_SimulateBulkVotes(?)', [electionID]);
    const [count] = await adminPool.query('SELECT COUNT(*) AS total FROM Vote WHERE ElectionID = ?', [electionID]);
    console.log(`[ADMIN] ✅ Simulation complete: ${count[0].total} votes`);
    return res.json({ success: true, code: 'SIMULATION_COMPLETE', totalVotes: count[0].total, message: 'Bulk vote simulation completed.' });
  } catch (err) {
    console.error('[ADMIN] ❌ Simulation error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Simulation failed: ' + err.message });
  }
});

// POST /api/admin/mark-winners — Determine winners
router.post('/mark-winners', async (req, res) => {
  const electionID = req.body.electionID || 1;
  console.log(`[ADMIN] Marking winners for ElectionID=${electionID}`);
  try {
    await adminPool.query('CALL sp_MarkWinners(?)', [electionID]);
    const [winners] = await adminPool.query('SELECT COUNT(*) AS total FROM Result WHERE ElectionID = ? AND IsWinner = 1', [electionID]);
    console.log(`[ADMIN] ✅ Winners marked: ${winners[0].total}`);
    return res.json({ success: true, code: 'WINNERS_MARKED', winnersCount: winners[0].total, message: 'Winners marked successfully.' });
  } catch (err) {
    console.error('[ADMIN] ❌ Mark winners error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Mark winners failed: ' + err.message });
  }
});

// POST /api/admin/reset-votes — Reset for fresh demo
router.post('/reset-votes', async (req, res) => {
  const { confirmReset } = req.body;
  if (confirmReset !== 'CONFIRM_RESET_2025') {
    return res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid reset confirmation token.' });
  }
  console.log('[ADMIN] ⚠️ Resetting votes, results, authentication...');
  try {
    const conn = await adminPool.getConnection();
    // Drop immutability triggers that block TRUNCATE
    await conn.query('DROP TRIGGER IF EXISTS trg_before_vote_delete');
    await conn.query('DROP TRIGGER IF EXISTS trg_before_vote_update');
    await conn.query('DROP TRIGGER IF EXISTS trg_after_vote_insert');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE Vote');
    await conn.query('TRUNCATE TABLE Result');
    await conn.query('TRUNCATE TABLE Authentication');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    // Recreate triggers
    await conn.query(`CREATE TRIGGER trg_before_vote_delete BEFORE DELETE ON Vote FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Votes cannot be deleted.'; END`);
    await conn.query(`CREATE TRIGGER trg_before_vote_update BEFORE UPDATE ON Vote FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Votes cannot be modified after casting.'; END`);
    await conn.query(`CREATE TRIGGER trg_after_vote_insert AFTER INSERT ON Vote FOR EACH ROW BEGIN INSERT INTO Result (ElectionID, CandidateID, ConstituencyID, TotalVotes, IsWinner) SELECT NEW.ElectionID, NEW.CandidateID, c.ConstituencyID, 1, 0 FROM Candidate c WHERE c.CandidateID = NEW.CandidateID ON DUPLICATE KEY UPDATE TotalVotes = TotalVotes + 1; INSERT INTO AuditLog (TableName, Action, RecordID, ChangedBy, NewValues) VALUES ('Vote', 'INSERT', NEW.VoteID, 'TRIGGER', CONCAT('VoterID=',NEW.VoterID,',CandID=',NEW.CandidateID,',ElecID=',NEW.ElectionID)); END`);
    // Re-initialize Result table with 0 votes for all candidates
    await conn.query(`INSERT INTO Result (ElectionID, CandidateID, ConstituencyID, TotalVotes, IsWinner)
      SELECT 1, c.CandidateID, c.ConstituencyID, 0, 0 FROM Candidate c WHERE c.ElectionID = 1`);
      
    // Reopen the election for fresh voting
    await conn.query(`UPDATE Election SET Status = 'Active' WHERE ElectionID = 1`);
    conn.release();
    console.log('[ADMIN] ✅ Reset complete');
    return res.json({ success: true, code: 'RESET_COMPLETE', message: 'All votes, results, and auth records have been reset.' });
  } catch (err) {
    console.error('[ADMIN] ❌ Reset error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Reset failed: ' + err.message });
  }
});

// GET /api/admin/audit-log — Last 100 audit entries
router.get('/audit-log', async (req, res) => {
  try {
    const [rows] = await readPool.query('SELECT * FROM AuditLog ORDER BY LogID DESC LIMIT 100');
    return res.json({ success: true, auditLog: rows });
  } catch (err) {
    console.error('[ADMIN] ❌ Audit log error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch audit log.' });
  }
});

// GET /api/admin/auth-attempts — Recent auth attempts
router.get('/auth-attempts', async (req, res) => {
  try {
    const [rows] = await readPool.query('SELECT * FROM Authentication ORDER BY AuthID DESC LIMIT 100');
    return res.json({ success: true, authAttempts: rows });
  } catch (err) {
    console.error('[ADMIN] ❌ Auth attempts error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch auth attempts.' });
  }
});

// GET /api/admin/voters — Paginated voter list
router.get('/voters', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  try {
    const [rows] = await readPool.query(
      `SELECT v.VoterID, v.VoterName, v.Gender, v.ConstituencyID,
              con.ConstituencyName, reg.RegionName, v.IsActive,
              CASE WHEN vt.VoteID IS NOT NULL THEN 1 ELSE 0 END AS HasVoted
       FROM Voter v
       JOIN Constituency con ON v.ConstituencyID = con.ConstituencyID
       JOIN Region reg ON con.RegionID = reg.RegionID
       LEFT JOIN Vote vt ON v.VoterID = vt.VoterID AND vt.ElectionID = 1
       ORDER BY v.VoterID LIMIT ? OFFSET ?`, [limit, offset]);
    const [total] = await readPool.query('SELECT COUNT(*) AS total FROM Voter');
    return res.json({ success: true, voters: rows, total: total[0].total, page, limit });
  } catch (err) {
    console.error('[ADMIN] ❌ Voters error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch voters.' });
  }
});

// GET /api/admin/candidates — All candidates with vote counts
router.get('/candidates', async (req, res) => {
  try {
    const [rows] = await readPool.query(
      `SELECT c.CandidateID, c.CandidateName, c.AgeAtElection, c.Education, c.IsNOTA,
              pp.PartyCode, pp.PartyName, con.ConstituencyName,
              COALESCE(r.TotalVotes, 0) AS TotalVotes, COALESCE(r.IsWinner, 0) AS IsWinner
       FROM Candidate c
       JOIN PoliticalParty pp ON c.PartyID = pp.PartyID
       JOIN Constituency con ON c.ConstituencyID = con.ConstituencyID
       LEFT JOIN Result r ON c.CandidateID = r.CandidateID AND r.ElectionID = 1
       WHERE c.ElectionID = 1
       ORDER BY con.ConstituencyID, c.IsNOTA, c.CandidateID`);
    return res.json({ success: true, candidates: rows });
  } catch (err) {
    console.error('[ADMIN] ❌ Candidates error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch candidates.' });
  }
});

module.exports = router;
