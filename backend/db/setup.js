require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function setup() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅  Database schema created successfully.');
  } catch (err) {
    console.error('❌  Schema setup failed:', err.message);
  } finally {
    await pool.end();
  }
}

setup();
