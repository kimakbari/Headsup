const router = require('express').Router();
const { query, withTransaction } = require('../db');
const { getProjectPerms } = require('../middleware/auth');

// Fixed roster of blocker teams — see also BLOCKER_TEAMS in frontend/src/utils.js
const BLOCKER_TEAMS = [
  'Last mile', 'Infra & dev', 'Execution', 'Maintenance and HSE',
  'Central Procurement', 'Recruitment', 'R&C', 'Ops Data', 'Data',
  'Market place', 'Market', 'HR', 'Commercial', 'Finance', 'Smart', 'Product',
];

// ── helpers ──────────────────────────────────────────────────────────────────
async function calcProgress(taskRow, subs) {
  if (!subs.length) return taskRow.status === 'done' ? 100 : 0;
  if (taskRow.weighted) {
    const total = subs.reduce((a, s) => a + (s.weight || 0), 0) || 1;
    const done  = subs.filter(s => s.done).reduce((a, s) => a + (s.weight || 0), 0);
    return Math.round((done / total) * 100);
  }
  return Math.round((subs.filter(s => s.done).length / subs.length) * 100);
}

async function logActivity(client, taskId, member, action) {
  await client.query(
    'INSERT INTO activity_log (task_id, member_id, member_name, action) VALUES ($1,$2,$3,$4)',
    [taskId, member.id, member.display_name, action]
  );
}

async function buildTask(row, userId, isAdmin) {
  const { rows: subs } = await query(
    'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position, created_at', [row.id]
  );
  const { rows: subAssignees } = await query(
    `SELECT sa.subtask_id, m.id, m.display_name, m.initials, m.color
       FROM subtask_assignees sa
       JOIN members m ON m.id = sa.member_id
      WHERE sa.subtask_id = ANY($1::uuid[])
      ORDER BY m.display_name`,
    [subs.map(s => s.id)]
  );
  const assigneesBySubtask = {};
  subAssignees.forEach(a => {
    (assigneesBySubtask[a.subtask_id] ||= []).push({
      id: a.id, displayName: a.display_name, initials: a.initials, color: a.color,
    });
  });
  const { rows: attachments } = await query(
    'SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at', [row.id]
  );
  const { rows: activity } = await query(
    'SELECT * FROM activity_log WHERE task_id = $1 ORDER BY created_at DESC LIMIT 50', [row.id]
  );
  const { rows: comments } = await query(
    `SELECT tc.*, m.initials, m.color
       FROM task_comments tc
       LEFT JOIN members m ON m.id = tc.member_id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at ASC`,
    [row.id]
  );
  const { rows: owners } = await query(
    `SELECT m.id, m.display_name, m.initials, m.color
       FROM task_owners tow
       JOIN members m ON m.id = tow.member_id
      WHERE tow.task_id = $1
      ORDER BY m.display_name`,
    [row.id]
  );

  // RACI — Accountable / Responsible / Consulted / Informed, each a single member
  const raciIds = [row.accountable_id, row.responsible_id, row.consulted_id, row.informed_id].filter(Boolean);
  const { rows: raciRows } = raciIds.length
    ? await query('SELECT id, display_name, initials, color FROM members WHERE id = ANY($1::uuid[])', [raciIds])
    : { rows: [] };
  const raciById = {};
  raciRows.forEach(m => {
    raciById[m.id] = { id: m.id, displayName: m.display_name, initials: m.initials, color: m.color };
  });

  const progress = await calcProgress(row, subs);
  const perms    = await getProjectPerms(userId, row.project_id, isAdmin);

  return {
    id:          row.id,
    projectId:   row.project_id,
    title:       row.title,
    owners: owners.map(o => ({
      id:          o.id,
      displayName: o.display_name,
      initials:    o.initials,
      color:       o.color,
    })),
    deadline:    row.deadline,
    priority:    row.priority,
    status:      row.status,
    description: row.description,
    weighted:    row.weighted,
    blockedByTeam: row.blocked_by_team,
    accountable: raciById[row.accountable_id] || null,
    responsible: raciById[row.responsible_id] || null,
    consulted:   raciById[row.consulted_id] || null,
    informed:    raciById[row.informed_id] || null,
    progress,
    perms,
    subtasks: subs.map(s => ({
      id:        s.id,
      title:     s.title,
      done:      s.done,
      weight:    s.weight,
      position:  s.position,
      deadline:  s.deadline,
      assignees: assigneesBySubtask[s.id] || [],
    })),
    attachments: attachments.map(a => ({
      id:           a.id,
      originalName: a.original_name,
      storedName:   a.stored_name,
    })),
    activity: activity.map(a => ({
      id:         a.id,
      memberName: a.member_name,
      action:     a.action,
      createdAt:  a.created_at,
    })),
    comments: comments.map(c => ({
      id:             c.id,
      memberId:       c.member_id,
      memberName:     c.member_name,
      memberInitials: c.initials || '?',
      memberColor:    c.color || '#ccc',
      body:           c.body,
      createdAt:      c.created_at,
    })),
  };
}

// GET /api/tasks?projectId=xxx  — list tasks for a board
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const perms = await getProjectPerms(req.user.id, projectId, req.user.is_admin);
    if (!perms.view) return res.status(403).json({ error: 'No view permission' });

    const { rows } = await query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [projectId]
    );

    const tasks = await Promise.all(rows.map(r => buildTask(r, req.user.id, req.user.is_admin)));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/my  — tasks assigned to current user
router.get('/my', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT t.* FROM tasks t
         JOIN task_owners tow ON tow.task_id = t.id
         JOIN project_members pm ON pm.project_id = t.project_id
        WHERE tow.member_id = $1
          AND pm.member_id = $1
          AND pm.perm_view = TRUE
          AND t.status NOT IN ('done','cancelled')
        ORDER BY t.deadline NULLS LAST`,
      [req.user.id]
    );
    const tasks = await Promise.all(rows.map(r => buildTask(r, req.user.id, req.user.is_admin)));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/my-projects  — every task in every project the member can view
router.get('/my-projects', async (req, res) => {
  try {
    const { rows: projectRows } = await query(
      `SELECT project_id FROM project_members WHERE member_id = $1 AND perm_view = TRUE`,
      [req.user.id]
    );
    if (!projectRows.length) return res.json([]);

    const { rows } = await query(
      `SELECT * FROM tasks WHERE project_id = ANY($1::uuid[]) ORDER BY deadline NULLS LAST`,
      [projectRows.map(p => p.project_id)]
    );
    const tasks = await Promise.all(rows.map(r => buildTask(r, req.user.id, req.user.is_admin)));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id  — task detail
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, rows[0].project_id, req.user.is_admin);
    if (!perms.view) return res.status(403).json({ error: 'No view permission' });

    res.json(await buildTask(rows[0], req.user.id, req.user.is_admin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks  — create task
router.post('/', async (req, res) => {
  try {
    const {
      projectId, title, ownerIds, deadline, priority, description, weighted, subtasks,
      accountableId, responsibleId, consultedId, informedId,
    } = req.body;
    if (!projectId || !title?.trim()) return res.status(400).json({ error: 'projectId and title required' });

    const perms = await getProjectPerms(req.user.id, projectId, req.user.is_admin);
    if (!perms.create) return res.status(403).json({ error: 'No create permission' });

    // Validate weighted subtasks
    const subs = subtasks || [];
    if (weighted && subs.length) {
      const sum = subs.reduce((a, s) => a + (parseInt(s.weight) || 0), 0);
      if (sum !== 100) return res.status(400).json({ error: `Subtask weights must total 100% (currently ${sum}%)` });
    }

    const owners = [...new Set(ownerIds || [])];

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO tasks (project_id, title, deadline, priority, description, weighted,
                             accountable_id, responsible_id, consulted_id, informed_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [projectId, title.trim(), deadline || null, priority || 'Medium', description?.trim() || null, !!weighted,
         accountableId || null, responsibleId || null, consultedId || null, informedId || null]
      );
      const task = rows[0];

      for (const ownerId of owners) {
        await client.query(
          'INSERT INTO task_owners (task_id, member_id) VALUES ($1,$2)', [task.id, ownerId]
        );
      }

      for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        if (!s.title?.trim()) continue;
        const { rows: subRow } = await client.query(
          'INSERT INTO subtasks (task_id, title, done, weight, position, deadline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [task.id, s.title.trim(), !!s.done, parseInt(s.weight) || 0, i, s.deadline || null]
        );
        // Subtask assignees must be drawn from the task's own owners
        const subAssignees = [...new Set(s.assigneeIds || [])].filter(mid => owners.includes(mid));
        for (const memberId of subAssignees) {
          await client.query(
            'INSERT INTO subtask_assignees (subtask_id, member_id) VALUES ($1,$2)', [subRow[0].id, memberId]
          );
        }
      }

      await logActivity(client, task.id, req.user, 'created this task');
      return task;
    });

    const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [result.id]);
    res.status(201).json(await buildTask(rows[0], req.user.id, req.user.is_admin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id  — update task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existing } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, existing[0].project_id, req.user.is_admin);
    if (!perms.edit) return res.status(403).json({ error: 'No edit permission' });

    const {
      title, ownerIds, deadline, priority, description, weighted, subtasks,
      accountableId, responsibleId, consultedId, informedId,
    } = req.body;

    const subs = subtasks || [];
    if (weighted && subs.length) {
      const sum = subs.reduce((a, s) => a + (parseInt(s.weight) || 0), 0);
      if (sum !== 100) return res.status(400).json({ error: `Subtask weights must total 100% (currently ${sum}%)` });
    }

    const owners = [...new Set(ownerIds || [])];

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE tasks SET title=$1, deadline=$2, priority=$3, description=$4, weighted=$5,
                           accountable_id=$6, responsible_id=$7, consulted_id=$8, informed_id=$9
          WHERE id=$10`,
        [title.trim(), deadline || null, priority, description?.trim() || null, !!weighted,
         accountableId || null, responsibleId || null, consultedId || null, informedId || null, id]
      );

      await client.query('DELETE FROM task_owners WHERE task_id = $1', [id]);
      for (const ownerId of owners) {
        await client.query(
          'INSERT INTO task_owners (task_id, member_id) VALUES ($1,$2)', [id, ownerId]
        );
      }

      await client.query('DELETE FROM subtasks WHERE task_id = $1', [id]);
      for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        if (!s.title?.trim()) continue;
        const { rows: subRow } = await client.query(
          'INSERT INTO subtasks (task_id, title, done, weight, position, deadline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [id, s.title.trim(), !!s.done, parseInt(s.weight) || 0, i, s.deadline || null]
        );
        // Subtask assignees must be drawn from the task's own owners
        const subAssignees = [...new Set(s.assigneeIds || [])].filter(mid => owners.includes(mid));
        for (const memberId of subAssignees) {
          await client.query(
            'INSERT INTO subtask_assignees (subtask_id, member_id) VALUES ($1,$2)', [subRow[0].id, memberId]
          );
        }
      }

      await logActivity(client, id, req.user, 'edited this task');
    });

    const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    res.json(await buildTask(rows[0], req.user.id, req.user.is_admin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id/status  — move task to new status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, blockedByTeam } = req.body;
    const valid = ['todo','doing','done','pending','approval','cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    if (status === 'pending' && !BLOCKER_TEAMS.includes(blockedByTeam)) {
      return res.status(400).json({ error: 'Pick which team this is blocked on' });
    }

    const { rows: existing } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, existing[0].project_id, req.user.is_admin);
    if (!perms.edit) return res.status(403).json({ error: 'No edit permission' });

    const statusLabels = {
      todo: 'To Do', doing: 'Doing', done: 'Done',
      pending: 'Pending', approval: 'Waiting for Approval', cancelled: 'Cancelled',
    };
    // Being blocked on a team only makes sense while the task is actually Pending
    const teamForColumn = status === 'pending' ? blockedByTeam : null;

    await withTransaction(async (client) => {
      await client.query('UPDATE tasks SET status=$1, blocked_by_team=$2 WHERE id=$3', [status, teamForColumn, id]);
      const note = status === 'pending' ? ` (blocked by ${teamForColumn})` : '';
      await logActivity(client, id, req.user, `moved this to ${statusLabels[status]}${note}`);
    });

    res.json({ ok: true, status, blockedByTeam: teamForColumn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id/move  — move task to a different project on the same team
router.put('/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId: newProjectId } = req.body;
    if (!newProjectId) return res.status(400).json({ error: 'projectId is required' });

    const { rows: existing } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Task not found' });
    const oldProjectId = existing[0].project_id;
    if (newProjectId === oldProjectId) return res.status(400).json({ error: 'Task is already in this project' });

    const sourcePerms = await getProjectPerms(req.user.id, oldProjectId, req.user.is_admin);
    if (!sourcePerms.edit) return res.status(403).json({ error: 'No edit permission on the current project' });

    const destPerms = await getProjectPerms(req.user.id, newProjectId, req.user.is_admin);
    if (!destPerms.create) return res.status(403).json({ error: 'No create permission on the destination project' });

    const { rows: srcProject }  = await query('SELECT * FROM projects WHERE id = $1', [oldProjectId]);
    const { rows: destProject } = await query('SELECT * FROM projects WHERE id = $1', [newProjectId]);
    if (!destProject.length) return res.status(404).json({ error: 'Destination project not found' });
    if (destProject[0].team_id !== srcProject[0].team_id) {
      return res.status(400).json({ error: 'Can only move tasks between projects on the same team' });
    }

    await withTransaction(async (client) => {
      await client.query('UPDATE tasks SET project_id = $1 WHERE id = $2', [newProjectId, id]);
      // Owners and subtask assignees were chosen from the old project's roster and may not apply here
      await client.query('DELETE FROM task_owners WHERE task_id = $1', [id]);
      await client.query(
        'DELETE FROM subtask_assignees WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = $1)',
        [id]
      );
      await logActivity(client, id, req.user, `moved this task to "${destProject[0].title}"`);
    });

    res.json({ ok: true, projectId: newProjectId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id  — delete task
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, rows[0].project_id, req.user.is_admin);
    if (!perms.delete) return res.status(403).json({ error: 'No delete permission' });

    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/comments  — add a comment (anyone with view access)
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { body, mentionedIds } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    const { rows: task } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!task.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, task[0].project_id, req.user.is_admin);
    if (!perms.view) return res.status(403).json({ error: 'No view permission' });

    const { rows } = await query(
      `INSERT INTO task_comments (task_id, member_id, member_name, body)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, req.user.id, req.user.display_name, body.trim()]
    );
    const c = rows[0];

    // Notify mentioned people — only those who can actually see this project, excluding self-mentions
    const candidateIds = [...new Set(mentionedIds || [])].filter(mid => mid !== req.user.id);
    if (candidateIds.length) {
      const { rows: valid } = await query(
        `SELECT id FROM members
          WHERE id = ANY($1::uuid[])
            AND (is_admin = TRUE OR id IN (SELECT member_id FROM project_members WHERE project_id = $2))`,
        [candidateIds, task[0].project_id]
      );
      for (const v of valid) {
        await query(
          `INSERT INTO mentions (member_id, task_id, comment_id, actor_name) VALUES ($1,$2,$3,$4)`,
          [v.id, id, c.id, req.user.display_name]
        );
      }
    }

    res.status(201).json({
      id:             c.id,
      memberId:       c.member_id,
      memberName:     c.member_name,
      memberInitials: req.user.initials,
      memberColor:    req.user.color,
      body:           c.body,
      createdAt:      c.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id/subtasks/:subId  — toggle subtask done
router.put('/:id/subtasks/:subId', async (req, res) => {
  try {
    const { id, subId } = req.params;
    const { rows: task } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!task.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, task[0].project_id, req.user.is_admin);
    if (!perms.edit) return res.status(403).json({ error: 'No edit permission' });

    const { done } = req.body;
    await query('UPDATE subtasks SET done=$1 WHERE id=$2 AND task_id=$3', [!!done, subId, id]);

    const { rows: subs } = await query('SELECT * FROM subtasks WHERE task_id = $1', [id]);
    const progress = await calcProgress(task[0], subs);
    res.json({ ok: true, progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/subtasks  — add a subtask inline (from task detail)
router.post('/:id/subtasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const { rows: task } = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!task.length) return res.status(404).json({ error: 'Task not found' });

    const perms = await getProjectPerms(req.user.id, task[0].project_id, req.user.is_admin);
    if (!perms.edit) return res.status(403).json({ error: 'No edit permission' });

    const { rows: count } = await query('SELECT COUNT(*) FROM subtasks WHERE task_id = $1', [id]);
    const { rows: sub } = await query(
      'INSERT INTO subtasks (task_id, title, done, weight, position) VALUES ($1,$2,FALSE,0,$3) RETURNING *',
      [id, title.trim(), parseInt(count[0].count)]
    );
    res.status(201).json({ id: sub[0].id, title: sub[0].title, done: false, weight: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/notifications/upcoming  — tasks AND subtasks with upcoming/overdue deadlines
router.get('/notifications/upcoming', async (req, res) => {
  try {
    const { user } = req;
    let taskRows, subtaskRows;

    if (user.is_admin) {
      const { rows } = await query(
        `SELECT t.*, p.title AS project_title FROM tasks t
           JOIN projects p ON p.id = t.project_id
          WHERE t.status NOT IN ('done','cancelled')
            AND t.deadline <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY t.deadline`
      );
      taskRows = rows;

      const { rows: subs } = await query(
        `SELECT s.id, s.title, s.deadline, t.id AS task_id, t.title AS task_title,
                t.project_id, p.title AS project_title
           FROM subtasks s
           JOIN tasks t ON t.id = s.task_id
           JOIN projects p ON p.id = t.project_id
          WHERE s.done = FALSE
            AND t.status NOT IN ('done','cancelled')
            AND s.deadline <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY s.deadline`
      );
      subtaskRows = subs;
    } else {
      const { rows } = await query(
        `SELECT DISTINCT t.*, p.title AS project_title FROM tasks t
           JOIN projects p ON p.id = t.project_id
           JOIN task_owners tow ON tow.task_id = t.id
           JOIN project_members pm ON pm.project_id = t.project_id
          WHERE tow.member_id = $1
            AND pm.member_id = $1
            AND pm.perm_view = TRUE
            AND t.status NOT IN ('done','cancelled')
            AND t.deadline <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY t.deadline`,
        [user.id]
      );
      taskRows = rows;

      const { rows: subs } = await query(
        `SELECT DISTINCT s.id, s.title, s.deadline, t.id AS task_id, t.title AS task_title,
                t.project_id, p.title AS project_title
           FROM subtasks s
           JOIN subtask_assignees sa ON sa.subtask_id = s.id
           JOIN tasks t ON t.id = s.task_id
           JOIN projects p ON p.id = t.project_id
           JOIN project_members pm ON pm.project_id = t.project_id
          WHERE sa.member_id = $1
            AND pm.member_id = $1
            AND pm.perm_view = TRUE
            AND s.done = FALSE
            AND t.status NOT IN ('done','cancelled')
            AND s.deadline <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY s.deadline`,
        [user.id]
      );
      subtaskRows = subs;
    }

    res.json({
      tasks: taskRows.map(t => ({
        id:           t.id,
        title:        t.title,
        deadline:     t.deadline,
        projectTitle: t.project_title,
        projectId:    t.project_id,
        overdue:      new Date(t.deadline) < new Date(),
      })),
      subtasks: subtaskRows.map(s => ({
        id:           s.id,
        title:        s.title,
        deadline:     s.deadline,
        taskId:       s.task_id,
        taskTitle:    s.task_title,
        projectId:    s.project_id,
        projectTitle: s.project_title,
        overdue:      new Date(s.deadline) < new Date(),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
