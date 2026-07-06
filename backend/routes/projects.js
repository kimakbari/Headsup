const router = require('express').Router();
const { query, withTransaction } = require('../db');
const { requireAdmin, getProjectPerms } = require('../middleware/auth');

// ── helpers ──────────────────────────────────────────────────────────────────
async function calcTaskProgress(taskId) {
  const { rows: subs } = await query(
    'SELECT done, weight FROM subtasks WHERE task_id = $1', [taskId]
  );
  if (!subs.length) return 0;

  const { rows: task } = await query('SELECT weighted, status FROM tasks WHERE id = $1', [taskId]);
  if (!task.length) return 0;
  if (task[0].status === 'done') return 100;

  if (task[0].weighted) {
    const total = subs.reduce((a, s) => a + (s.weight || 0), 0) || 1;
    const done  = subs.filter(s => s.done).reduce((a, s) => a + (s.weight || 0), 0);
    return Math.round((done / total) * 100);
  }
  return Math.round((subs.filter(s => s.done).length / subs.length) * 100);
}

async function calcProjectProgress(projectId) {
  const { rows: tasks } = await query(
    `SELECT id FROM tasks WHERE project_id = $1 AND status != 'cancelled'`, [projectId]
  );
  if (!tasks.length) return 0;
  const progs = await Promise.all(tasks.map(t => calcTaskProgress(t.id)));
  return Math.round(progs.reduce((a, p) => a + p, 0) / progs.length);
}

// GET /api/projects?teamId=xxx
router.get('/', async (req, res) => {
  try {
    const { teamId } = req.query;
    const { user } = req;

    let projectRows;
    if (teamId) {
      if (user.is_admin) {
        const { rows } = await query(
          'SELECT * FROM projects WHERE team_id = $1 ORDER BY created_at DESC', [teamId]
        );
        projectRows = rows;
      } else {
        const { rows } = await query(
          `SELECT p.* FROM projects p
             JOIN project_members pm ON pm.project_id = p.id
            WHERE p.team_id = $1 AND pm.member_id = $2 AND pm.perm_view = TRUE
            ORDER BY p.created_at DESC`,
          [teamId, user.id]
        );
        projectRows = rows;
      }
    } else {
      if (user.is_admin) {
        const { rows } = await query('SELECT * FROM projects ORDER BY created_at DESC');
        projectRows = rows;
      } else {
        const { rows } = await query(
          `SELECT p.* FROM projects p
             JOIN project_members pm ON pm.project_id = p.id
            WHERE pm.member_id = $1 AND pm.perm_view = TRUE
            ORDER BY p.created_at DESC`,
          [user.id]
        );
        projectRows = rows;
      }
    }

    const result = await Promise.all(projectRows.map(async (p) => {
      const progress = await calcProjectProgress(p.id);
      const { rows: members } = await query(
        `SELECT m.id, m.display_name, m.initials, m.color,
                pm.perm_view, pm.perm_edit, pm.perm_create, pm.perm_delete
           FROM project_members pm
           JOIN members m ON m.id = pm.member_id
          WHERE pm.project_id = $1`,
        [p.id]
      );
      const { rows: taskCount } = await query(
        'SELECT COUNT(*) FROM tasks WHERE project_id = $1', [p.id]
      );
      const perms = await getProjectPerms(user.id, p.id, user.is_admin);

      return {
        id:          p.id,
        teamId:      p.team_id,
        title:       p.title,
        deadline:    p.deadline,
        description: p.description,
        progress,
        taskCount:   parseInt(taskCount[0].count),
        perms,
        members: members.map(m => ({
          id:          m.id,
          displayName: m.display_name,
          initials:    m.initials,
          color:       m.color,
          perms: {
            view:   m.perm_view,
            edit:   m.perm_edit,
            create: m.perm_create,
            delete: m.perm_delete,
          },
        })),
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects  — create project (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { teamId, title, deadline, description, members } = req.body;
    if (!teamId || !title?.trim()) {
      return res.status(400).json({ error: 'teamId and title are required' });
    }

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO projects (team_id, title, deadline, description) VALUES ($1,$2,$3,$4) RETURNING *',
        [teamId, title.trim(), deadline || null, description?.trim() || null]
      );
      const project = rows[0];

      if (members?.length) {
        for (const m of members) {
          const p = m.perms || {};
          await client.query(
            `INSERT INTO project_members (project_id, member_id, perm_view, perm_edit, perm_create, perm_delete)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [project.id, m.memberId, !!p.view, !!p.edit, !!p.create, !!p.delete]
          );
        }
      }
      return project;
    });

    res.status(201).json({ id: result.id, title: result.title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id  — update project (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, deadline, description, members } = req.body;

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE projects SET title=$1, deadline=$2, description=$3 WHERE id=$4',
        [title.trim(), deadline || null, description?.trim() || null, id]
      );
      if (members) {
        await client.query('DELETE FROM project_members WHERE project_id = $1', [id]);
        for (const m of members) {
          const p = m.perms || {};
          await client.query(
            `INSERT INTO project_members (project_id, member_id, perm_view, perm_edit, perm_create, perm_delete)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, m.memberId, !!p.view, !!p.edit, !!p.create, !!p.delete]
          );
        }
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id  — delete project (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/home  — data for admin home page (all teams + projects + progress)
router.get('/home', async (req, res) => {
  try {
    const { rows: teams } = await query('SELECT * FROM teams ORDER BY name');

    const result = await Promise.all(teams.map(async (t) => {
      const { rows: projects } = await query(
        'SELECT * FROM projects WHERE team_id = $1 ORDER BY created_at DESC', [t.id]
      );
      const projectsWithProgress = await Promise.all(projects.map(async (p) => ({
        id:       p.id,
        title:    p.title,
        deadline: p.deadline,
        progress: await calcProjectProgress(p.id),
      })));

      const teamProgress = projectsWithProgress.length
        ? Math.round(projectsWithProgress.reduce((a, p) => a + p.progress, 0) / projectsWithProgress.length)
        : 0;

      const { rows: members } = await query(
        `SELECT m.initials, m.color FROM team_members tm
           JOIN members m ON m.id = tm.member_id
          WHERE tm.team_id = $1 LIMIT 5`,
        [t.id]
      );

      return {
        id:       t.id,
        name:     t.name,
        color:    t.color,
        icon:     t.icon,
        progress: teamProgress,
        avatars:  members,
        projects: projectsWithProgress,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
