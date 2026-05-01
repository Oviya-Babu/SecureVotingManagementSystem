
// ============================================================
// middleware/validateInput.js — Input validation middleware
// Validates Aadhaar format, vote fields, etc.
// ============================================================

function validateAadhaar(req, res, next) {
  const { aadhaar } = req.body;

  if (!aadhaar) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'Aadhaar number is required.'
    });
  }

  // Strip spaces for formatted input (e.g., "9000 0000 0001")
  const cleaned = String(aadhaar).replace(/\s/g, '');

  if (!/^\d{12}$/.test(cleaned)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_AADHAAR',
      message: 'Please enter a valid 12-digit Aadhaar number.'
    });
  }

  req.body.aadhaar = cleaned;
  next();
}

function validateVote(req, res, next) {
  const { voterID, candidateID, electionID } = req.body;

  if (!voterID || !candidateID || !electionID) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'voterID, candidateID and electionID are all required.'
    });
  }

  if (isNaN(voterID) || isNaN(candidateID) || isNaN(electionID)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_FORMAT',
      message: 'voterID, candidateID and electionID must be numeric.'
    });
  }

  req.body.voterID = parseInt(voterID);
  req.body.candidateID = parseInt(candidateID);
  req.body.electionID = parseInt(electionID);
  next();
}

function validateBiometric(req, res, next) {
  const { voterID, fingerprint } = req.body;

  if (!voterID || !fingerprint) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'voterID and fingerprint are required for biometric verification.'
    });
  }

  if (isNaN(voterID)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_FORMAT',
      message: 'voterID must be numeric.'
    });
  }

  if (typeof fingerprint !== 'string' || fingerprint.length < 4) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_FINGERPRINT',
      message: 'Valid fingerprint data is required.'
    });
  }

  req.body.voterID = parseInt(voterID);
  next();
}

// validateFingerprintCode — for POST /auth/verify-biometric
// Accepts fingerprintCode as the 12-digit Aadhaar number for demo purposes
function validateFingerprintCode(req, res, next) {
  const { aadhaar, fingerprintCode } = req.body;

  if (!aadhaar || !fingerprintCode) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_FIELDS',
      message: 'aadhaar and fingerprintCode are required.'
    });
  }

  const cleaned = String(aadhaar).replace(/\s/g, '');
  if (!/^\d{12}$/.test(cleaned)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_AADHAAR',
      message: 'Invalid Aadhaar format.'
    });
  }

  const cleanedFp = String(fingerprintCode).replace(/\s/g, '');
  if (!/^\d{12}$/.test(cleanedFp)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_FORMAT',
      message: 'Fingerprint code must be your 12-digit Aadhaar number.'
    });
  }

  req.body.aadhaar = cleaned;
  req.body.fingerprintCode = cleanedFp;
  next();
}

module.exports = { validateAadhaar, validateVote, validateBiometric, validateFingerprintCode };
