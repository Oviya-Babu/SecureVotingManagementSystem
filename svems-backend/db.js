// ============================================================
// db.js — Application Pool (Write Operations)
// Used by: Auth, Vote, Candidate routes
// Pool size: 10 connections
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.APP_DB_HOST || 'localhost',
  user: process.env.APP_DB_USER || 'root',
  password: process.env.APP_DB_PASSWORD || '',
  database: process.env.APP_DB_NAME || 'SecureVotingSystem',
  port: parseInt(process.env.APP_DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Verify connection on import
pool.getConnection()
  .then(conn => {
    console.log('[DB-APP] ✅ Connection pool established (10 connections)');
    conn.release();
  })
  .catch(err => {
    console.error('[DB-APP] ❌ Connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
