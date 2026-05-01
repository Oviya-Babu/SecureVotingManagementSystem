// ============================================================
// middleware/rateLimiter.js
// Auth: 20 requests per 15 minutes (per Aadhaar/voterID key)
// Vote: NO rate limit — handled by JWT session + DB UNIQUE constraint
// Admin: 50 requests per 5 minutes
// ============================================================

const rateLimit = require('express-rate-limit');

// Limiter for Aadhaar + Biometric endpoints
// Keyed by Aadhaar/voterID so concurrent users don't block each other
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  keyGenerator: (req) => {
    // Use Aadhaar or voterID as the rate-limit key (not global IP)
    const key = (req.body && (req.body.aadhaar || String(req.body.voterID))) || req.ip;
    return key;
  },
  skip: (req) => {
    // Never block if the request carries a valid-looking auth header
    // (biometric retry with token should not be limited as harshly)
    return false;
  },
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many attempts for this Aadhaar. Please wait 15 minutes and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Admin limiter
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many admin requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// voteLimiter is intentionally REMOVED — 
// vote endpoint is protected by JWT session + DB UNIQUE constraint on Vote(VoterID, ElectionID)
// No IP-based rate limiting is needed or safe here.
const voteLimiter = (req, res, next) => next(); // Pass-through

module.exports = { authLimiter, voteLimiter, adminLimiter };
