const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const { query } = require('../db');
const { getProjectPerms } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/uploads/:taskId  — attach a file to a task
router.post('/:taskId', upload.single('file'), async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { rows: task } = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, task[0].project_id, req.user.is_admin);
    if (!perms.edit) return res.status(403).json({ error: 'No edit permission' });

    const { rows } = await query(
      `INSERT INTO attachments (task_id, original_name, stored_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [taskId, req.file.originalname, req.file.filename]
    );

    res.status(201).json({
      id:           rows[0].id,
      originalName: rows[0].original_name,
      storedName:   rows[0].stored_name,
      url:          `/uploads/${rows[0].stored_name}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
