const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken, setCookie, authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const { rows } = await query(
      'SELECT * FROM members WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const member = rows[0];
    const valid = await bcrypt.compare(password, member.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const token = signToken(member.id, member.is_admin);
    setCookie(res, token);

    res.json({
      user: {
        id:          member.id,
        username:    member.username,
        displayName: member.display_name,
        initials:    member.initials,
        color:       member.color,
        isAdmin:     member.is_admin,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('kaputi_token');
  res.json({ ok: true });
});

// GET /api/auth/me  — returns current user (used on page refresh)
router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    user: {
      id:          u.id,
      username:    u.username,
      displayName: u.display_name,
      initials:    u.initials,
      color:       u.color,
      isAdmin:     u.is_admin,
    },
  });
});

module.exports = router;
