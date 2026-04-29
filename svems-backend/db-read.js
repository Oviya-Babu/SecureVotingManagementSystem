// ============================================================
// db-read.js — Read Pool (Results Dashboard)
// Used by: Results routes (live polling, charts, tables)
// Pool size: 20 connections (read-heavy workload)
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const readPool = mysql.createPool({
  host: process.env.APP_DB_HOST || 'localhost',
  user: process.env.READ_DB_USER || process.env.APP_DB_USER || 'root',
  password: process.env.READ_DB_PASSWORD || process.env.APP_DB_PASSWORD || '',
  database: process.env.APP_DB_NAME || 'SecureVotingSystem',
  port: parseInt(process.env.APP_DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

readPool.getConnection()
  .then(conn => {
    console.log('[DB-READ] ✅ Read pool established (20 connections)');
    conn.release();
  })
  .catch(err => {
    console.error('[DB-READ] ❌ Read pool connection failed:', err.message);
  });

module.exports = readPool;
