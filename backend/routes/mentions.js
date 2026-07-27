const router = require('express').Router();
const { query } = require('../db');

// GET /api/mentions  — current user's unread @mentions
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT mn.id, mn.task_id, mn.actor_name, mn.created_at,
              t.title AS task_title, t.project_id, p.title AS project_title
         FROM mentions mn
         JOIN tasks t    ON t.id = mn.task_id
         JOIN projects p ON p.id = t.project_id
        WHERE mn.member_id = $1 AND mn.is_read = FALSE
        ORDER BY mn.created_at DESC
        LIMIT 50`,
      [req.user.id]
    );
    res.json(rows.map(r => ({
      id:           r.id,
      taskId:       r.task_id,
      taskTitle:    r.task_title,
      projectId:    r.project_id,
      projectTitle: r.project_title,
      actorName:    r.actor_name,
      createdAt:    r.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/mentions/:id/read  — dismiss one mention
router.put('/:id/read', async (req, res) => {
  try {
    await query(
      'UPDATE mentions SET is_read = TRUE WHERE id = $1 AND member_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
