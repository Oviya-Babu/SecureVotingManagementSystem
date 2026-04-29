// ============================================================
// routes/auth.js — Authentication Routes
// POST /api/auth/aadhaar  — Verify Aadhaar in voter roll
// POST /api/auth/biometric — Simulate fingerprint verification
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { computeFingerprintHash } = require('../services/cryptoService');
const { validateAadhaar, validateBiometric } = require('../middleware/validateInput');
const { authLimiter } = require('../middleware/rateLimiter');

// Apply rate limiter to all auth routes
router.use(authLimiter);

// ─────────────────────────────────────────────
// POST /api/auth/aadhaar
// Step 1: Verify Aadhaar exists in voter roll
// ─────────────────────────────────────────────
router.post('/aadhaar', validateAadhaar, async (req, res) => {
  const { aadhaar } = req.body;
  console.log(`[AUTH] Aadhaar verification request: ${aadhaar.substring(0, 4)}****${aadhaar.substring(8)}`);

  try {
    // Find voter by Aadhaar — JOIN VoterIdentity + Voter + Constituency + Region
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
      // Log failed attempt
      await logAuthAttempt(null, aadhaar, 'Failed', 'AADHAAR_NOT_FOUND', req.ip);
      return res.status(404).json({
        success: false,
        code: 'AADHAAR_NOT_FOUND',
        message: 'Invalid Aadhaar Number. Not found in voter roll.'
      });
    }

    const voter = rows[0];

    // Check voter is active
    if (!voter.IsActive) {
      await logAuthAttempt(voter.VoterID, aadhaar, 'Failed', 'VOTER_INACTIVE', req.ip);
      return res.status(403).json({
        success: false,
        code: 'VOTER_INACTIVE',
        message: 'This voter account has been deactivated.'
      });
    }

    // Check if already voted (ElectionID = 1)
    const [voteRows] = await db.query(
      'SELECT VoteID FROM Vote WHERE VoterID = ? AND ElectionID = 1',
      [voter.VoterID]
    );

    if (voteRows.length > 0) {
      await logAuthAttempt(voter.VoterID, aadhaar, 'Failed', 'ALREADY_VOTED', req.ip);
      return res.status(403).json({
        success: false,
        code: 'ALREADY_VOTED',
        message: 'Vote already recorded. Duplicate voting is not allowed.'
      });
    }

    // Log successful Aadhaar verification
    await logAuthAttempt(voter.VoterID, aadhaar, 'BiometricPending', null, req.ip);

    console.log(`[AUTH] ✅ Aadhaar verified for VoterID=${voter.VoterID} (${voter.VoterName})`);

    return res.json({
      success: true,
      code: 'AADHAAR_VERIFIED',
      voterID: voter.VoterID,
      voterName: voter.VoterName,
      constituencyID: voter.ConstituencyID,
      constituencyName: voter.ConstituencyName,
      regionName: voter.RegionName,
      aadhaarNumber: voter.AadhaarNumber,
      message: 'Aadhaar verified. Proceed to biometric scan.'
    });

  } catch (err) {
    console.error('[AUTH] ❌ Aadhaar verification error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error. Please try again in a moment.'
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/biometric
// Step 2: Simulated fingerprint verification
// ─────────────────────────────────────────────
router.post('/biometric', validateBiometric, async (req, res) => {
  const { voterID } = req.body;
  console.log(`[AUTH] Biometric verification request for VoterID=${voterID}`);

  try {
    // Fetch stored hash and Aadhaar (hash NEVER sent to client)
    const [rows] = await db.query(
      `SELECT vi.AadhaarNumber, vi.FingerprintHash
       FROM VoterIdentity vi
       WHERE vi.VoterID = ?`,
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

    const { fingerprint } = req.body;
    
    // Compute fingerprint hash server-side using actual input + salt
    const computedHash = computeFingerprintHash(fingerprint);

    // Compare hashes
    if (computedHash !== FingerprintHash) {
      // Update auth record to Failed
      await updateAuthStatus(voterID, 'Failed', 'BIOMETRIC_MISMATCH');
      console.log(`[AUTH] ❌ Biometric mismatch for VoterID=${voterID}`);
      return res.status(401).json({
        success: false,
        code: 'BIOMETRIC_MISMATCH',
        message: 'Biometric verification failed. Fingerprint does not match.'
      });
    }

    // Update auth record to Success
    await updateAuthStatus(voterID, 'Success', null);
    console.log(`[AUTH] ✅ Biometric verified for VoterID=${voterID}`);

    return res.json({
      success: true,
      code: 'BIOMETRIC_VERIFIED',
      message: 'Biometric verification successful.'
    });

  } catch (err) {
    console.error('[AUTH] ❌ Biometric verification error:', err.message);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error. Please try again in a moment.'
    });
  }
});

// ─────────────────────────────────────────────
// Helper: Log authentication attempt
// ─────────────────────────────────────────────
async function logAuthAttempt(voterID, aadhaar, status, failReason, ip) {
  if (!voterID) return; // Skip logging for invalid Aadhaar (no valid VoterID for FK)
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

// ─────────────────────────────────────────────
// Helper: Update latest auth status for voter
// ─────────────────────────────────────────────
async function updateAuthStatus(voterID, status, failReason) {
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
