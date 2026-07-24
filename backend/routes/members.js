const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const COLORS = [
  '#5FA8A0','#E2B25E','#9B86C4','#7FA87B',
  '#D9614B','#6B8FB5','#C97FB0','#E07A5F',
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// GET /api/members  — list all non-admin members
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, display_name, initials, color, is_admin, created_at
         FROM members
        WHERE is_admin = FALSE
        ORDER BY display_name`
    );
    res.json(rows.map(r => ({
      id:          r.id,
      username:    r.username,
      displayName: r.display_name,
      initials:    r.initials,
      color:       r.color,
      isAdmin:     r.is_admin,
      createdAt:   r.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/members/me  — current user's own profile + teams they belong to
router.get('/me', async (req, res) => {
  try {
    const { rows: teams } = await query(
      `SELECT t.id, t.name, t.icon, t.color
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
        WHERE tm.member_id = $1
        ORDER BY t.name`,
      [req.user.id]
    );
    res.json({
      id:          req.user.id,
      username:    req.user.username,
      displayName: req.user.display_name,
      initials:    req.user.initials,
      color:       req.user.color,
      isAdmin:     req.user.is_admin,
      teams,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/members/me  — self-service: change own username and/or password
router.put('/me', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username?.trim()) return res.status(400).json({ error: 'Username is required' });

    const { rows: existing } = await query(
      'SELECT id FROM members WHERE LOWER(username) = LOWER($1) AND id != $2',
      [username.trim(), req.user.id]
    );
    if (existing.length) return res.status(409).json({ error: 'Username is already taken' });

    if (newPassword?.trim()) {
      if (!currentPassword?.trim()) {
        return res.status(400).json({ error: 'Enter your current password to set a new one' });
      }
      const { rows } = await query('SELECT password_hash FROM members WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword.trim(), rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(newPassword.trim(), 10);
      await query('UPDATE members SET username = $1, password_hash = $2 WHERE id = $3', [username.trim(), hash, req.user.id]);
    } else {
      await query('UPDATE members SET username = $1 WHERE id = $2', [username.trim(), req.user.id]);
    }

    res.json({ id: req.user.id, username: username.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/members  — create member (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username?.trim() || !password?.trim() || !displayName?.trim()) {
      return res.status(400).json({ error: 'username, password and displayName are required' });
    }

    // Check username uniqueness
    const { rows: existing } = await query(
      'SELECT id FROM members WHERE LOWER(username) = LOWER($1)', [username.trim()]
    );
    if (existing.length) return res.status(409).json({ error: 'Username is already taken' });

    const hash     = await bcrypt.hash(password.trim(), 10);
    const initials = getInitials(displayName);

    // Assign next color in rotation
    const { rows: count } = await query('SELECT COUNT(*) FROM members');
    const color = COLORS[parseInt(count[0].count) % COLORS.length];

    const { rows } = await query(
      `INSERT INTO members (username, password_hash, display_name, initials, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, display_name, initials, color`,
      [username.trim(), hash, displayName.trim(), initials, color]
    );

    const m = rows[0];
    res.status(201).json({ id: m.id, username: m.username, displayName: m.display_name, initials: m.initials, color: m.color });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/members/:id  — update member (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, displayName } = req.body;

    if (!username?.trim() || !displayName?.trim()) {
      return res.status(400).json({ error: 'username and displayName are required' });
    }

    // Check username uniqueness (excluding current)
    const { rows: existing } = await query(
      'SELECT id FROM members WHERE LOWER(username) = LOWER($1) AND id != $2',
      [username.trim(), id]
    );
    if (existing.length) return res.status(409).json({ error: 'Username is already taken' });

    const initials = getInitials(displayName);

    let updatedRows;
    if (password?.trim()) {
      const hash = await bcrypt.hash(password.trim(), 10);
      const { rows } = await query(
        `UPDATE members
            SET username = $1, password_hash = $2, display_name = $3, initials = $4
          WHERE id = $5
          RETURNING id, username, display_name, initials, color`,
        [username.trim(), hash, displayName.trim(), initials, id]
      );
      updatedRows = rows;
    } else {
      const { rows } = await query(
        `UPDATE members
            SET username = $1, display_name = $2, initials = $3
          WHERE id = $4
          RETURNING id, username, display_name, initials, color`,
        [username.trim(), displayName.trim(), initials, id]
      );
      updatedRows = rows;
    }

    if (!updatedRows.length) return res.status(404).json({ error: 'Member not found' });
    const m = updatedRows[0];
    res.json({ id: m.id, username: m.username, displayName: m.display_name, initials: m.initials, color: m.color });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/members/:id  — delete member (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting the admin account
    const { rows } = await query('SELECT is_admin FROM members WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    if (rows[0].is_admin) return res.status(403).json({ error: 'Cannot delete the admin account' });

    await query('DELETE FROM members WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
