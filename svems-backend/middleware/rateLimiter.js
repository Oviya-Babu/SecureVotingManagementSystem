// ============================================================
// middleware/rateLimiter.js — Rate limiting per IP
// Auth: 10 requests per 15 minutes
// Vote: 3 requests per 1 hour
// ============================================================

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many vote attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many admin requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, voteLimiter, adminLimiter };
