// ============================================================
// services/cryptoService.js — SHA-256 cryptographic operations
// - Fingerprint hash computation (server-side only)
// - Vote receipt hash generation
// ============================================================

const crypto = require('crypto');

const FP_SALT = process.env.FP_SALT || 'FP_SALT_2025_';

/**
 * Compute fingerprint hash from fingerprint input.
 * Formula: SHA256(FP_SALT + fingerprint_input)
 * This hash is NEVER sent to the frontend.
 */
function computeFingerprintHash(fingerprintInput) {
  return crypto
    .createHash('sha256')
    .update(FP_SALT + fingerprintInput)
    .digest('hex');
}

/**
 * Generate a cryptographic receipt hash for a cast vote.
 * Formula: SHA256(voterID|candidateID|electionID|timestamp)
 */
function generateReceiptHash(voterID, candidateID, electionID) {
  const timestamp = new Date().toISOString();
  const payload = `${voterID}|${candidateID}|${electionID}|${timestamp}`;
  const hash = crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
  return { hash, timestamp };
}

module.exports = { computeFingerprintHash, generateReceiptHash };
