// ============================================================
// server.js — Express Application Entry Point
// Secure Voting Election Management System
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request Logger ──
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Static Files (Frontend) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──
const authRoutes = require('./routes/auth');
const voteRoutes = require('./routes/vote');
const candidateRoutes = require('./routes/candidates');
const resultRoutes = require('./routes/results');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ──
const db = require('./db');
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT DATABASE() AS db, NOW() AS serverTime');
    res.json({
      status: 'running',
      database: rows[0].db,
      serverTime: rows[0].serverTime,
      uptime: process.uptime(),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── SPA Fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    code: 'SERVER_ERROR',
    message: 'An unexpected error occurred.'
  });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  SVEMS — Secure Voting Election Management System ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Server:   http://localhost:${PORT}                  ║`);
  console.log(`║  API:      http://localhost:${PORT}/api              ║`);
  console.log(`║  Health:   http://localhost:${PORT}/api/health       ║`);
  console.log('║  Database: SecureVotingSystem (MySQL)              ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
});
