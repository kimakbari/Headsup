const router = require('express').Router();
const { query } = require('../db');

// GET /api/notifications  — current user's unread notifications (mentions + task updates)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.type, n.task_id, n.actor_name, n.note, n.created_at,
              t.title AS task_title, t.project_id, p.title AS project_title
         FROM notifications n
         JOIN tasks t    ON t.id = n.task_id
         JOIN projects p ON p.id = t.project_id
        WHERE n.member_id = $1 AND n.is_read = FALSE
        ORDER BY n.created_at DESC
        LIMIT 50`,
      [req.user.id]
    );
    res.json(rows.map(r => ({
      id:           r.id,
      type:         r.type,
      taskId:       r.task_id,
      taskTitle:    r.task_title,
      projectId:    r.project_id,
      projectTitle: r.project_title,
      actorName:    r.actor_name,
      note:         r.note,
      createdAt:    r.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read  — dismiss one
router.put('/:id/read', async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND member_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
