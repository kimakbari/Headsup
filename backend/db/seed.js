require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

const MEMBER_COLORS = [
  '#5FA8A0','#E2B25E','#9B86C4','#7FA87B',
  '#D9614B','#6B8FB5','#C97FB0','#E07A5F',
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

async function seed() {
  const client = await pool.connect();
  try {
    // ── Admin account ──────────────────────────────────────────────────────
    const adminUser     = process.env.ADMIN_USERNAME     || 'admin';
    const adminPass     = process.env.ADMIN_PASSWORD     || 'admin123';
    const adminName     = process.env.ADMIN_DISPLAY_NAME || 'Admin';
    const adminHash     = await bcrypt.hash(adminPass, 10);
    const adminInitials = getInitials(adminName);

    await client.query(`
      INSERT INTO members (username, password_hash, display_name, initials, color, is_admin)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (username) DO NOTHING
    `, [adminUser, adminHash, adminName, adminInitials, '#E07A5F']);

    console.log(`✅  Admin account ready  →  username: "${adminUser}"  password: "${adminPass}"`);
    console.log('    Change the password after your first login!');
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
