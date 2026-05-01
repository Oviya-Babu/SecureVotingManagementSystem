// ============================================================
// routes/auth.js — Authentication Routes (JWT Session-Based)
// POST /api/auth/aadhaar  — Step 1: Verify Aadhaar → issues step-1 token
// POST /api/auth/biometric — Step 2: Verify fingerprint → issues step-2 token
// ============================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { computeFingerprintHash } = require('../services/cryptoService');
const { validateAadhaar, validateBiometric, validateFingerprintCode } = require('../middleware/validateInput');

const JWT_SECRET = process.env.JWT_SECRET || 'SVEMS_JWT_SECRET_2025_DO_NOT_EXPOSE';
const TOKEN_EXPIRY = '15m'; // Session valid for 15 minutes

// ─────────────────────────────────────────────
// POST /api/auth/aadhaar
// Step 1: Verify Aadhaar → issues aadhaar-verified token
// ─────────────────────────────────────────────
router.post('/aadhaar', validateAadhaar, async (req, res) => {
  const { aadhaar } = req.body;
  console.log(`[AUTH] Aadhaar request: ${aadhaar.substring(0, 4)}****${aadhaar.substring(8)}`);

  try {
    // 1. Check Election is Active
    const [electionRows] = await db.query('SELECT Status FROM Election WHERE ElectionID = 1');
    const electionStatus = electionRows[0]?.Status;
    if (electionStatus !== 'Active') {
      return res.status(403).json({
        success: false,
        code: 'ELECTION_NOT_ACTIVE',
        message: electionStatus === 'Upcoming'
          ? 'The election has not started yet.'
          : 'The election period has ended.'
      });
    }

    // 2. Find voter by Aadhaar
    const [rows] = await db.query(
      `SELECT vi.VoterID, v.VoterName, v.ConstituencyID, v.IsActive,
              con.ConstituencyName, reg.RegionName, vi.AadhaarNumber
       FROM VoterIdentity vi
       JOIN Voter v ON vi.VoterID = v.VoterID
       JOIN Constituency con ON v.ConstituencyID = con.ConstituencyID
       JOIN Region reg ON con.RegionID = reg.RegionID
       WHERE vi.AadhaarNumber = ?`,
      [aadhaar]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'INVALID_AADHAAR',
        message: 'Invalid Aadhaar Number. Not found in voter roll.'
      });
    }

    const voter = rows[0];

    if (!voter.IsActive) {
      return res.status(403).json({
        success: false,
        code: 'VOTER_INACTIVE',
        message: 'This voter account has been deactivated.'
      });
    }

    // 3. Check if already voted
    const [voteRows] = await db.query(
      'SELECT VoteID FROM Vote WHERE VoterID = ? AND ElectionID = 1',
      [voter.VoterID]
    );
    if (voteRows.length > 0) {
      return res.status(403).json({
        success: false,
        code: 'ALREADY_VOTED',
        message: 'This voter has already cast their vote.'
      });
    }

    // 4. Issue JWT with full voting rights (biometric is UI-only, not a real gate)
    const token = jwt.sign(
      {
        voterID: voter.VoterID,
        aadhaarVerified: true,
        biometricVerified: true,   // Pre-set true — biometric step is simulation only
        constituencyID: voter.ConstituencyID
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // 5. Log in Authentication table
    logAuthAttempt(voter.VoterID, aadhaar, 'Success', null, req.ip);

    console.log(`[AUTH] ✅ Aadhaar verified for VoterID=${voter.VoterID} (${voter.VoterName})`);

    return res.json({
      success: true,
      code: 'AADHAAR_VERIFIED',
      token,
      voterID: voter.VoterID,
      voterName: voter.VoterName,
      constituencyID: voter.ConstituencyID,
      constituencyName: voter.ConstituencyName,
      regionName: voter.RegionName,
      aadhaarNumber: voter.AadhaarNumber,
      message: 'Aadhaar verified. Please complete biometric scan.'
    });

  } catch (err) {
    console.error('[AUTH] ❌ Aadhaar error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/biometric
// Step 2: Verify fingerprint → issues fully-verified token
// Requires step-1 token in Authorization header
// ─────────────────────────────────────────────
router.post('/biometric', validateBiometric, async (req, res) => {
  const { voterID, fingerprint } = req.body;
  console.log(`[AUTH] Biometric request for VoterID=${voterID}`);

  // 1. Validate step-1 JWT
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_REQUIRED',
      message: 'Aadhaar verification session required. Please start from step 1.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please verify your Aadhaar again.'
    });
  }

  // 2. Validate token belongs to this voter and aadhaar was verified
  if (decoded.voterID !== parseInt(voterID) || !decoded.aadhaarVerified) {
    return res.status(403).json({
      success: false,
      code: 'SESSION_INVALID',
      message: 'Invalid session. Please restart from Aadhaar verification.'
    });
  }

  try {
    // 3. Fetch stored fingerprint hash (NEVER sent to client)
    const [rows] = await db.query(
      'SELECT AadhaarNumber, FingerprintHash FROM VoterIdentity WHERE VoterID = ?',
      [voterID]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'IDENTITY_NOT_FOUND',
        message: 'Voter identity record not found.'
      });
    }

    const { AadhaarNumber, FingerprintHash } = rows[0];

    // 4. Compute and compare hash
    const computedHash = computeFingerprintHash(fingerprint);

    if (computedHash !== FingerprintHash) {
      logAuthUpdate(voterID, 'Failed', 'BIOMETRIC_MISMATCH');
      console.log(`[AUTH] ❌ Biometric mismatch for VoterID=${voterID}`);
      return res.status(401).json({
        success: false,
        code: 'BIOMETRIC_FAILED',
        message: 'Biometric verification failed. Fingerprint does not match.'
      });
    }

    // 5. Issue fully-verified step-2 JWT
    const verifiedToken = jwt.sign(
      {
        voterID: decoded.voterID,
        aadhaarVerified: true,
        biometricVerified: true,
        constituencyID: decoded.constituencyID
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // 6. Update auth log
    logAuthUpdate(voterID, 'Success', null);

    console.log(`[AUTH] ✅ Biometric verified for VoterID=${voterID}`);

    return res.json({
      success: true,
      code: 'BIOMETRIC_VERIFIED',
      token: verifiedToken,
      message: 'Biometric verification successful. You may now cast your vote.'
    });

  } catch (err) {
    console.error('[AUTH] ❌ Biometric error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/verify-biometric
// Validates fingerprint code matches the user's Aadhaar number (demo simplification)
// ─────────────────────────────────────────────
router.post('/verify-biometric', validateFingerprintCode, async (req, res) => {
  const { aadhaar, fingerprintCode } = req.body;
  console.log(`[AUTH] Biometric verify for Aadhaar=${aadhaar.substring(0,4)}****`);

  // 1. Validate JWT
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, code: 'SESSION_REQUIRED', message: 'Session expired. Please verify Aadhaar first.' });
  }
  let session;
  try {
    session = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ success: false, code: 'SESSION_EXPIRED', message: 'Session expired. Please verify Aadhaar again.' });
  }
  if (!session.aadhaarVerified) {
    return res.status(403).json({ success: false, code: 'SESSION_INVALID', message: 'Please complete Aadhaar verification first.' });
  }

  // 2. The fingerprintCode should be exactly the user's Aadhaar number
  if (fingerprintCode !== aadhaar) {
    console.log(`[AUTH] ❌ Biometric fail: fingerprint code does not match Aadhaar`);
    return res.status(401).json({ success: false, code: 'BIOMETRIC_FAILED', message: 'Invalid fingerprint code. It must match your Aadhaar number.' });
  }

  // 3. DB cross-check: confirm the provided Aadhaar belongs to the session's VoterID
  try {
    const [rows] = await db.query(
      'SELECT VoterID FROM VoterIdentity WHERE AadhaarNumber = ? AND VoterID = ?',
      [aadhaar, session.voterID]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, code: 'BIOMETRIC_FAILED', message: 'Biometric verification failed. Identity record not found.' });
    }
  } catch (err) {
    console.error('[AUTH] ❌ DB error in verify-biometric:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Internal error.' });
  }

  console.log(`[AUTH] ✅ Biometric verified for VoterID=${session.voterID}`);
  return res.json({ success: true, code: 'BIOMETRIC_VERIFIED', message: 'Biometric verification successful. You may now proceed to vote.' });
});

// ─────────────────────────────────────────────
// Helpers — non-blocking, best-effort DB logging
// ─────────────────────────────────────────────
async function logAuthAttempt(voterID, aadhaar, status, failReason, ip) {
  if (!voterID) return;
  try {
    await db.query(
      `INSERT INTO Authentication (VoterID, AadhaarUsed, Status, FailReason, IPAddress)
       VALUES (?, ?, ?, ?, ?)`,
      [voterID, aadhaar, status, failReason, ip || '127.0.0.1']
    );
  } catch (err) {
    console.error('[AUTH] Warning: Failed to log auth attempt:', err.message);
  }
}

async function logAuthUpdate(voterID, status, failReason) {
  try {
    await db.query(
      `UPDATE Authentication SET Status = ?, FailReason = ?
       WHERE VoterID = ? ORDER BY AuthID DESC LIMIT 1`,
      [status, failReason, voterID]
    );
  } catch (err) {
    console.error('[AUTH] Warning: Failed to update auth status:', err.message);
  }
}

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
