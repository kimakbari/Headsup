const { query, withTransaction } = require('../db');

const STEP_DAYS = { daily: 1, weekly: 7 };

// Advances a 'YYYY-MM-DD' deadline forward by whole repeat-periods until it's
// today or later — catches a task up even if the server was down for a while.
function nextDeadline(deadline, repeat) {
  const step = STEP_DAYS[repeat];
  const d = new Date(deadline + 'T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  while (d < today) {
    d.setUTCDate(d.getUTCDate() + step);
  }
  return d.toISOString().slice(0, 10);
}

// Resets any repeating task whose deadline has passed: status back to To Do,
// subtasks unchecked, deadline rolled forward to its next occurrence.
async function rolloverRecurringTasks() {
  const { rows } = await query(
    `SELECT id, repeat, deadline FROM tasks
      WHERE repeat IS NOT NULL AND deadline IS NOT NULL AND deadline < CURRENT_DATE`
  );

  for (const t of rows) {
    const deadline = nextDeadline(t.deadline, t.repeat);
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE tasks SET status='todo', deadline=$1, blocked_by_team=NULL WHERE id=$2`,
        [deadline, t.id]
      );
      await client.query('UPDATE subtasks SET done=FALSE WHERE task_id=$1', [t.id]);
      await client.query(
        `INSERT INTO activity_log (task_id, member_name, action) VALUES ($1,$2,$3)`,
        [t.id, 'System', `reset this ${t.repeat} task for its next occurrence`]
      );
    });
  }

  return rows.length;
}

function startRecurringTaskScheduler() {
  rolloverRecurringTasks().catch(err => console.error('Recurring task rollover failed:', err));
  setInterval(() => {
    rolloverRecurringTasks().catch(err => console.error('Recurring task rollover failed:', err));
  }, 60 * 60 * 1000); // re-check hourly
}

module.exports = { rolloverRecurringTasks, startRecurringTaskScheduler };
