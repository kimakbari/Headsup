const router = require('express').Router();
const { query, withTransaction } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const COLORS = [
  '#5FA8A0','#E2B25E','#9B86C4','#7FA87B',
  '#D9614B','#6B8FB5','#C97FB0','#E07A5F',
];

const ICONS = ['👥','🚀','💡','🎯','🛠️','📊','🌱','🔥','⭐','🎨','📦','🧭'];

// GET /api/teams  — list teams (admin: all; member: only teams they belong to)
router.get('/', async (req, res) => {
  try {
    const { user } = req;
    let teams;

    if (user.is_admin) {
      const { rows } = await query('SELECT * FROM teams ORDER BY name');
      teams = rows;
    } else {
      const { rows } = await query(
        `SELECT t.* FROM teams t
           JOIN team_members tm ON tm.team_id = t.id
          WHERE tm.member_id = $1
          ORDER BY t.name`,
        [user.id]
      );
      teams = rows;
    }

    // Attach members to each team
    const result = await Promise.all(teams.map(async (t) => {
      const { rows: members } = await query(
        `SELECT m.id, m.display_name, m.initials, m.color,
                tm.perm_view, tm.perm_edit, tm.perm_create, tm.perm_delete
           FROM team_members tm
           JOIN members m ON m.id = tm.member_id
          WHERE tm.team_id = $1
          ORDER BY m.display_name`,
        [t.id]
      );
      return {
        id:    t.id,
        name:  t.name,
        color: t.color,
        icon:  t.icon,
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

// POST /api/teams  — create team (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, members, icon } = req.body;
    // members: [{ memberId, perms: { view, edit, create, delete } }]
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });
    if (!members?.length) return res.status(400).json({ error: 'Add at least one member' });

    const result = await withTransaction(async (client) => {
      const { rows: count } = await client.query('SELECT COUNT(*) FROM teams');
      const color = COLORS[parseInt(count[0].count) % COLORS.length];
      const teamIcon = ICONS.includes(icon) ? icon : ICONS[0];

      const { rows } = await client.query(
        'INSERT INTO teams (name, color, icon) VALUES ($1, $2, $3) RETURNING *', [name.trim(), color, teamIcon]
      );
      const team = rows[0];
      for (const m of members) {
        const p = m.perms || {};
        await client.query(
          `INSERT INTO team_members (team_id, member_id, perm_view, perm_edit, perm_create, perm_delete)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [team.id, m.memberId, !!p.view, !!p.edit, !!p.create, !!p.delete]
        );
      }
      return team;
    });

    res.status(201).json({ id: result.id, name: result.name, color: result.color, icon: result.icon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/teams/:id  — update team (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, members, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });

    await withTransaction(async (client) => {
      if (icon && ICONS.includes(icon)) {
        await client.query('UPDATE teams SET name = $1, icon = $2 WHERE id = $3', [name.trim(), icon, id]);
      } else {
        await client.query('UPDATE teams SET name = $1 WHERE id = $2', [name.trim(), id]);
      }
      if (members) {
        await client.query('DELETE FROM team_members WHERE team_id = $1', [id]);
        for (const m of members) {
          const p = m.perms || {};
          await client.query(
            `INSERT INTO team_members (team_id, member_id, perm_view, perm_edit, perm_create, perm_delete)
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

// DELETE /api/teams/:id  — delete team (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM teams WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
