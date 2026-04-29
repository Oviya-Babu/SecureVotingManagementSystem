// ============================================================
// db-admin.js — Admin Pool (Simulation & Reset)
// Used by: Admin routes (simulate, mark-winners, reset)
// Pool size: 5 connections (restricted)
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const adminPool = mysql.createPool({
  host: process.env.APP_DB_HOST || 'localhost',
  user: process.env.ADMIN_DB_USER || process.env.APP_DB_USER || 'root',
  password: process.env.ADMIN_DB_PASSWORD || process.env.APP_DB_PASSWORD || '',
  database: process.env.APP_DB_NAME || 'SecureVotingSystem',
  port: parseInt(process.env.APP_DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

adminPool.getConnection()
  .then(conn => {
    console.log('[DB-ADMIN] ✅ Admin pool established (5 connections)');
    conn.release();
  })
  .catch(err => {
    console.error('[DB-ADMIN] ❌ Admin pool connection failed:', err.message);
  });

module.exports = adminPool;
