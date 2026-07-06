const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'kaputi_dev_secret';

// ── authenticate ──────────────────────────────────────────────────────────────
// Reads JWT from the "kaputi_token" httpOnly cookie, verifies it,
// then attaches the full member row to req.user.
async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.kaputi_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = jwt.verify(token, JWT_SECRET);

    const { rows } = await query(
      'SELECT id, username, display_name, initials, color, is_admin FROM members WHERE id = $1',
      [payload.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ── requireAdmin ──────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── getProjectPerms ───────────────────────────────────────────────────────────
// Returns the current user's permissions for a project.
// Admin always gets full access.
async function getProjectPerms(userId, projectId, isAdmin) {
  if (isAdmin) return { view: true, edit: true, create: true, delete: true };

  const { rows } = await query(
    `SELECT perm_view, perm_edit, perm_create, perm_delete
       FROM project_members
      WHERE project_id = $1 AND member_id = $2`,
    [projectId, userId]
  );

  if (!rows.length) return { view: false, edit: false, create: false, delete: false };
  const r = rows[0];
  return {
    view:   r.perm_view,
    edit:   r.perm_edit,
    create: r.perm_create,
    delete: r.perm_delete,
  };
}

// ── signToken ─────────────────────────────────────────────────────────────────
function signToken(userId, isAdmin) {
  return jwt.sign({ userId, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
}

// ── setCookie ─────────────────────────────────────────────────────────────────
function setCookie(res, token) {
  res.cookie('kaputi_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

module.exports = { authenticate, requireAdmin, getProjectPerms, signToken, setCookie };
