import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { fmtDate, deadlineColor, prioMeta, statusMeta } from '../utils';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export default function MyTasks() {
  const { user }               = useAuth();
  const [view, setView]       = useState('mine'); // 'mine' | 'projects'
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy]   = useState('deadline'); // 'deadline' | 'priority'
  const [search, setSearch]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const endpoint = view === 'projects' ? '/tasks/my-projects' : '/tasks/my';
    api.get(endpoint).then(r => setTasks(r.data)).finally(() => setLoading(false));
  }, [view]);

  // We need project title — fetch projects separately
  const [projects, setProjects] = useState({});
  useEffect(() => {
    api.get('/projects').then(r => {
      const map = {};
      r.data.forEach(p => map[p.id] = p);
      setProjects(map);
    }).catch(() => {});
  }, []);

  const toggleSubtaskDone = async (taskId, subId, done) => {
    try {
      await api.put(`/tasks/${taskId}/subtasks/${subId}`, { done: !done });
      setTasks(ts => ts.map(t => t.id !== taskId ? t : {
        ...t,
        subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !done } : s),
      }));
    } catch {}
  };

  if (loading) return (
    <>
      <Topbar />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  // In "My tasks", show the individual subtasks assigned to me instead of the whole
  // task — a task with no subtasks (or none assigned to me specifically) still shows
  // as a task-level card so nothing owned falls out of view.
  const items = view === 'mine'
    ? tasks.flatMap(t => {
        const mySubs = t.subtasks?.filter(s => s.assignees?.some(a => a.id === user.id)) || [];
        if (mySubs.length) {
          return mySubs.map(s => ({
            kind:      'subtask',
            id:        `${t.id}:${s.id}`,
            subtaskId: s.id,
            taskId:    t.id,
            projectId: t.projectId,
            title:     s.title,
            done:      s.done,
            deadline:  s.deadline,
            priority:  t.priority,
            status:    t.status,
            taskTitle: t.title,
          }));
        }
        return [{ kind: 'task', id: t.id, ...t }];
      })
    : tasks.map(t => ({ kind: 'task', id: t.id, ...t }));

  const enrichedItems = items
    .map(it => ({ ...it, project: projects[it.projectId] }))
    .filter(it => it.project);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? enrichedItems.filter(it =>
        it.project.title.toLowerCase().includes(q) ||
        it.title.toLowerCase().includes(q) ||
        (it.taskTitle || '').toLowerCase().includes(q))
    : enrichedItems;

  const sorted = [...filtered].sort((a, b) => {
    const deadlineDiff = (a.deadline ? new Date(a.deadline) : Infinity) - (b.deadline ? new Date(b.deadline) : Infinity);
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return sortBy === 'priority'
      ? (priorityDiff || deadlineDiff)
      : (deadlineDiff || priorityDiff);
  });

  return (
    <>
      <Topbar />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '26px 2px 18px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.8px' }}>My Tasks</div>
          <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 15, marginTop: 3 }}>
            {view === 'projects' ? 'Every task across the projects you belong to' : 'Everything assigned to you, at a glance'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['mine', 'My tasks'], ['projects', 'My projects']].map(([key, label]) => (
              <button key={key} onClick={() => setView(key)} style={{
                border: `1.5px solid ${view === key ? 'var(--accent)' : 'var(--border)'}`,
                background: view === key ? 'var(--inner-bg)' : 'var(--card)',
                color: view === key ? 'var(--text)' : 'var(--text-3)',
                borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13,
                cursor: 'pointer', transition: 'all .15s',
              }}>{label}</button>
            ))}
          </div>
          {tasks.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[['deadline', 'Closest deadline'], ['priority', 'Highest priority']].map(([key, label]) => (
                <button key={key} onClick={() => setSortBy(key)} style={{
                  border: `1.5px solid ${sortBy === key ? 'var(--accent)' : 'var(--border)'}`,
                  background: sortBy === key ? 'var(--inner-bg)' : 'var(--card)',
                  color: sortBy === key ? 'var(--text)' : 'var(--text-3)',
                  borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer', transition: 'all .15s',
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tasks.length > 0 && (
        <div style={{ position: 'relative', margin: '4px 2px 20px', maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-3)' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects or tasks…"
            style={{
              width: '100%', padding: '12px 14px 12px 40px',
              border: '1.5px solid var(--border)', borderRadius: 13,
              fontSize: 14, fontWeight: 700, background: 'var(--card)', outline: 'none',
              transition: 'border-color .15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      )}

      {tasks.length === 0 && (
        <div style={{
          background: 'var(--card)', border: '1px dashed var(--border-2)',
          borderRadius: 18, padding: 48, textAlign: 'center',
          color: 'var(--text-3)', fontWeight: 800,
        }}>
          {view === 'projects' ? 'No tasks in your projects yet. 🌿' : 'You have no assigned tasks right now. 🌿'}
        </div>
      )}

      {tasks.length > 0 && sorted.length === 0 && (
        <div style={{
          background: 'var(--card)', border: '1px dashed var(--border-2)',
          borderRadius: 18, padding: 48, textAlign: 'center',
          color: 'var(--text-3)', fontWeight: 800,
        }}>
          No tasks match "{search.trim()}". 🌿
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {sorted.map(it => {
            const pm = prioMeta(it.priority);
            const sm = statusMeta(it.status);

            // ── Subtask-level card ──
            if (it.kind === 'subtask') {
              return (
                <div
                  key={it.id}
                  onClick={() => navigate(`/projects/${it.projectId}/tasks/${it.taskId}`)}
                  className="anim-pop"
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border-2)',
                    borderRadius: 16, boxShadow: 'var(--shadow-sm)',
                    padding: 15, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(44,39,34,.09)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  <div
                    onClick={e => { e.stopPropagation(); navigate(`/projects/${it.projectId}/board`); }}
                    style={{ fontWeight: 800, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}
                  >
                    {it.project.title}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-4)', marginBottom: 9 }}>
                    ↳ {it.taskTitle}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        onClick={e => { e.stopPropagation(); toggleSubtaskDone(it.taskId, it.subtaskId, it.done); }}
                        style={{
                          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                          border: `2px solid ${it.done ? sm.color : 'var(--checkbox-border)'}`,
                          background: it.done ? sm.color : 'var(--card)',
                          color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 900, cursor: 'pointer',
                        }}
                      >{it.done ? '✓' : ''}</span>
                      <span style={{
                        fontWeight: 800, fontSize: 15, lineHeight: 1.25,
                        color: it.done ? 'var(--text-3)' : 'var(--text)',
                        textDecoration: it.done ? 'line-through' : 'none',
                      }}>{it.title}</span>
                    </span>
                    <span style={{
                      flexShrink: 0, fontWeight: 800, fontSize: 11,
                      padding: '3px 9px', borderRadius: 999,
                      color: pm.color, background: pm.bg,
                    }}>{it.priority}</span>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: it.deadline ? deadlineColor(it.deadline, it.done ? 'done' : '') : 'var(--text-4)' }}>
                      {it.deadline ? `📅 ${fmtDate(it.deadline)}` : 'No deadline'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: sm.color }} />
                      <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-2)' }}>{sm.label}</span>
                    </span>
                  </div>
                </div>
              );
            }

            // ── Task-level card (fallback when a task has no subtasks assigned to me,
            //     or when browsing "My projects") ──
            const done  = it.subtasks?.filter(s => s.done).length || 0;
            const total = it.subtasks?.length || 0;
            return (
              <div
                key={it.id}
                onClick={() => navigate(`/projects/${it.projectId}/tasks/${it.id}`)}
                className="anim-pop"
                style={{
                  background: 'var(--card)', border: '1px solid var(--border-2)',
                  borderRadius: 16, boxShadow: 'var(--shadow-sm)',
                  padding: 15, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(44,39,34,.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              >
                <div
                  onClick={e => { e.stopPropagation(); navigate(`/projects/${it.projectId}/board`); }}
                  style={{ fontWeight: 800, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}
                >
                  {it.project.title}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                  <span style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.25 }}>{it.title}</span>
                  <span style={{
                    flexShrink: 0, fontWeight: 800, fontSize: 11,
                    padding: '3px 9px', borderRadius: 999,
                    color: pm.color, background: pm.bg,
                  }}>{it.priority}</span>
                </div>

                {/* Progress bar */}
                <div style={{ margin: '12px 0 8px', height: 8, borderRadius: 999, background: 'var(--inner-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: sm.color, width: `${it.progress}%`, transition: 'width .3s' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: deadlineColor(it.deadline, it.status) }}>
                    📅 {fmtDate(it.deadline)}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-3)' }}>
                    {done}/{total} subtasks
                  </span>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: sm.color }} />
                    <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-2)' }}>{sm.label}</span>
                  </span>
                  {view === 'projects' && it.owners?.length > 0 && (
                    <span style={{ display: 'flex' }}>
                      {it.owners.slice(0, 3).map((o, i) => (
                        <span key={o.id} title={o.displayName} style={{
                          width: 20, height: 20, borderRadius: 6,
                          background: o.color, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 9,
                          marginLeft: i > 0 ? -5 : 0, border: '2px solid var(--card)',
                        }}>{o.initials}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
