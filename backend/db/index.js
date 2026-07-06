const { Pool, types } = require('pg');
require('dotenv').config();

// DATE columns (OID 1082) come back from pg as JS Date objects constructed in the
// server's local timezone, which shifts the calendar day once serialized to JSON/UTC
// (e.g. a 2026-06-28 deadline became "2026-06-27T20:30:00.000Z"). Deadlines have no
// time component, so keep the raw 'YYYY-MM-DD' string Postgres already sends.
types.setTypeParser(1082, val => val);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'kaputi',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err);
});

// Helper: run a query and return rows
const query = (text, params) => pool.query(text, params);

// Helper: run within a transaction
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, withTransaction };
