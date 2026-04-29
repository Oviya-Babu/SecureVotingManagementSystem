const express = require('express');
const router = express.Router();
const readPool = require('../db-read');

router.get('/summary', async (req, res) => {
  try {
    const [tv] = await readPool.query('SELECT COUNT(*) AS total FROM Vote WHERE ElectionID=1');
    const [tr] = await readPool.query('SELECT COUNT(*) AS total FROM Voter WHERE IsActive=1');
    const [sd] = await readPool.query('SELECT COUNT(*) AS total FROM Result WHERE ElectionID=1 AND IsWinner=1');
    let wp = null;
    try { const [w] = await readPool.query('SELECT fn_GetWinningParty(1) AS wp'); wp = w[0].wp; } catch(e){}
    const total = tv[0].total, voters = tr[0].total;
    res.json({ success:true, totalVotesCast:total, totalRegisteredVoters:voters,
      turnoutPercentage: voters>0 ? parseFloat(((total/voters)*100).toFixed(2)) : 0,
      seatsDecided:sd[0].total, totalSeats:36, winningParty:wp });
  } catch(err) { console.error('[RESULTS]',err.message); res.status(500).json({success:false,message:'Failed'}); }
});

router.get('/final', async (req, res) => {
  try {
    const [rows] = await readPool.query('CALL sp_GetFinalResults(1)');
    res.json({ success:true, results: Array.isArray(rows[0]) ? rows[0] : rows });
  } catch(err) { console.error('[RESULTS]',err.message); res.status(500).json({success:false,message:'Failed'}); }
});

router.get('/constituency', async (req, res) => {
  try {
    const [rows] = await readPool.query('SELECT * FROM vw_constituencyresults ORDER BY ConstituencyID, TotalVotes DESC');
    res.json({ success:true, results:rows });
  } catch(err) { console.error('[RESULTS]',err.message); res.status(500).json({success:false,message:'Failed'}); }
});

router.get('/winners', async (req, res) => {
  try {
    const [rows] = await readPool.query('SELECT * FROM vw_Winners ORDER BY ConstituencyName');
    res.json({ success:true, winners:rows });
  } catch(err) { console.error('[RESULTS]',err.message); res.status(500).json({success:false,message:'Failed'}); }
});

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
       WHERE pp.PartyCode!='NOTA' GROUP BY pp.PartyID,pp.PartyCode,pp.PartyName
       ORDER BY seats DESC, votes DESC`);
    const total=tv[0].total, voters=tr[0].total;
    res.json({ success:true, totalVotes:total, totalVoters:voters,
      turnout: voters>0 ? ((total/voters)*100).toFixed(2) : '0.00',
      partyTally:pt, timestamp:new Date().toISOString() });
  } catch(err) { console.error('[RESULTS]',err.message); res.status(500).json({success:false,message:'Failed'}); }
});

module.exports = router;
