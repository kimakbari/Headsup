import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Topbar from '../components/Topbar';
import BlockedByModal from '../components/BlockedByModal';
import { STATUSES, statusMeta, prioMeta, fmtDate, deadlineColor } from '../utils';
import { useToast } from '../components/Toast';
import api from '../api';

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onOpen, onDragStart }) {
  const pm   = prioMeta(task.priority);
  const sm   = statusMeta(task.status);
  const done = task.subtasks?.filter(s => s.done).length || 0;
  const tot  = task.subtasks?.length || 0;

  return (
    <div
      draggable={task.perms?.edit}
      onDragStart={onDragStart}
      onClick={onOpen}
      style={{
        background: 'var(--card)', border: '1px solid var(--border-2)',
        borderRadius: 14, boxShadow: 'var(--shadow-sm)',
        padding: 14, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(44,39,34,.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <span style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>{task.title}</span>
        <span style={{
          flexShrink: 0, fontWeight: 800, fontSize: 10,
          padding: '3px 8px', borderRadius: 999,
          color: pm.color, background: pm.bg,
        }}>{task.priority}</span>
      </div>

      <div style={{ margin: '11px 0 6px', height: 7, borderRadius: 999, background: 'var(--inner-border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: sm.color, width: `${task.progress}%` }} />
      </div>

      {task.status === 'pending' && task.blockedByTeam && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontWeight: 800, fontSize: 10, color: sm.color, background: 'var(--inner-bg)',
          border: `1px solid ${sm.color}`, borderRadius: 999, padding: '3px 8px', marginBottom: 8,
        }}>
          🚧 Blocked by {task.blockedByTeam}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'flex' }}>
            {(task.owners?.length ? task.owners : [null]).slice(0, 3).map((o, i) => (
              <span key={o?.id || 'none'} style={{
                width: 24, height: 24, borderRadius: 7,
                background: o?.color || 'var(--text-4)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 10,
                marginLeft: i > 0 ? -6 : 0, border: '2px solid var(--card)',
              }}>{o?.initials || '?'}</span>
            ))}
          </span>
          <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-3)' }}>{done}/{tot}</span>
        </span>
        <span style={{ fontWeight: 800, fontSize: 11, color: deadlineColor(task.deadline, task.status) }}>
          📅 {fmtDate(task.deadline)}
        </span>
      </div>
    </div>
  );
}

// ── Create/Edit Task modal ────────────────────────────────────────────────────
function TaskModal({ projectId, projectMembers, editTask, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!editTask;
  const [form, setForm] = useState({
    title:       editTask?.title || '',
    ownerIds:    editTask?.owners?.map(o => o.id) || [],
    deadline:    editTask?.deadline ? editTask.deadline.slice(0, 10) : '',
    priority:    editTask?.priority || 'Medium',
    description: editTask?.description || '',
    weighted:    editTask?.weighted || false,
    subtasks:    editTask?.subtasks?.map(s => ({
                   ...s,
                   deadline:    s.deadline ? s.deadline.slice(0, 10) : '',
                   assigneeIds: s.assignees?.map(a => a.id) || [],
                 })) || [{ id: 'n1', title: '', done: false, weight: 0, deadline: '', assigneeIds: [] }],
    error:       '',
  });
  const set = p => setForm(f => ({ ...f, ...p }));

  const toggleOwner = id => set({
    ownerIds: form.ownerIds.includes(id)
      ? form.ownerIds.filter(x => x !== id)
      : [...form.ownerIds, id],
    // Dropping an owner also drops them from any subtask they were assigned to
    subtasks: form.ownerIds.includes(id)
      ? form.subtasks.map(s => ({ ...s, assigneeIds: s.assigneeIds.filter(x => x !== id) }))
      : form.subtasks,
  });

  const toggleSubAssignee = (subId, memberId) => set({
    subtasks: form.subtasks.map(s => s.id === subId
      ? { ...s, assigneeIds: s.assigneeIds.includes(memberId) ? s.assigneeIds.filter(x => x !== memberId) : [...s.assigneeIds, memberId] }
      : s),
  });

  const weightSum = form.subtasks.reduce((a, s) => a + (parseInt(s.weight) || 0), 0);

  const toggleWeighted = () => {
    const w = !form.weighted;
    let subs = form.subtasks;
    if (w && subs.length) {
      const n = subs.length;
      const even = Math.floor(100 / n);
      subs = subs.map((s, i) => ({ ...s, weight: i === 0 ? 100 - even * (n - 1) : even }));
    }
    set({ weighted: w, subtasks: subs });
  };

  const addSub = () => set({ subtasks: [...form.subtasks, { id: 'n' + Date.now(), title: '', done: false, weight: 0, deadline: '', assigneeIds: [] }] });
  const removeSub = id => set({ subtasks: form.subtasks.filter(s => s.id !== id) });
  const subField = (id, k, v) => set({ subtasks: form.subtasks.map(s => s.id === id ? { ...s, [k]: v } : s) });

  const save = async () => {
    if (!form.title.trim()) { set({ error: 'Give the task a title.' }); return; }
    const subs = form.subtasks.filter(s => s.title.trim()).map(s => ({ ...s, weight: parseInt(s.weight) || 0 }));
    if (form.weighted && subs.length && weightSum !== 100) {
      set({ error: `Subtask weights must total 100% (now ${weightSum}%).` }); return;
    }
    try {
      if (isEdit) {
        await api.put(`/tasks/${editTask.id}`, { ...form, subtasks: subs });
        toast('Task updated');
      } else {
        await api.post('/tasks', { projectId, ...form, subtasks: subs });
        toast('Task created');
      }
      onSaved();
    } catch (err) {
      set({ error: err.response?.data?.error || 'Something went wrong.' });
    }
  };

  const inp = {
    width: '100%', padding: '12px 14px',
    border: '1.5px solid var(--border)', borderRadius: 12,
    fontSize: 14, fontWeight: 700, background: 'var(--card)', outline: 'none',
    transition: 'border-color .15s',
  };

  return (
    <div
      onClick={onClose}
      className="anim-fade"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(44,39,34,.4)', backdropFilter: 'blur(3px)',
        zIndex: 70, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 20px', overflowY: 'auto',
      }}
    >
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{
        width: '100%', maxWidth: 560, background: 'var(--card)',
        borderRadius: 22, boxShadow: '0 30px 70px rgba(44,39,34,.3)', padding: 26,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.5px' }}>
            {isEdit ? 'Edit task' : 'Create task'}
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10, background: 'var(--inner-bg)',
            border: '1.5px solid var(--border)', cursor: 'pointer', fontWeight: 800,
          }}>✕</button>
        </div>

        {/* Title */}
        <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>Task title</label>
        <input value={form.title} onChange={e => set({ title: e.target.value, error: '' })} placeholder="e.g. Build offline sync" style={{ ...inp, marginBottom: 15 }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />

        {/* Owners */}
        <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>Owners</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
          {projectMembers.map(m => {
            const on = form.ownerIds.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => toggleOwner(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--inner-bg)' : 'var(--card)',
                borderRadius: 999, padding: '5px 12px 5px 5px', cursor: 'pointer',
                transition: 'all .15s',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: m.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 10,
                }}>{m.initials}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: on ? 'var(--text)' : 'var(--text-3)' }}>{m.displayName}</span>
              </button>
            );
          })}
          {projectMembers.length === 0 && (
            <span style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>No members on this project.</span>
          )}
        </div>

        {/* Deadline */}
        <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>Deadline</label>
        <input type="date" value={form.deadline} onChange={e => set({ deadline: e.target.value })} style={{ ...inp, marginBottom: 15 }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />

        {/* Priority */}
        <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>Priority</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['Low', 'Medium', 'High'].map(p => {
            const pm = prioMeta(p); const on = form.priority === p;
            return (
              <button key={p} onClick={() => set({ priority: p })} style={{
                flex: 1, padding: 10, borderRadius: 11, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                border: `1.5px solid ${on ? pm.color : 'var(--border)'}`,
                background: on ? pm.bg : 'var(--card)', color: on ? pm.color : 'var(--text-3)',
                transition: 'all .15s',
              }}>{p}</button>
            );
          })}
        </div>

        {/* Subtasks */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <label style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>Subtasks</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
            <span onClick={toggleWeighted} style={{
              width: 38, height: 22, borderRadius: 999,
              background: form.weighted ? 'var(--accent)' : 'var(--dashed-border)',
              position: 'relative', transition: 'background .2s',
            }}>
              <span style={{
                position: 'absolute', top: 2,
                left: form.weighted ? 18 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.25)',
              }} />
            </span>
            Weighted
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {form.subtasks.map(s => {
            const subOwners = projectMembers.filter(m => form.ownerIds.includes(m.id));
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input value={s.title} onChange={e => subField(s.id, 'title', e.target.value)} placeholder="Subtask title" style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--inner-bg)', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                  {form.weighted && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--inner-bg)', border: '1.5px solid var(--border)', borderRadius: 11, padding: '0 10px' }}>
                      <input type="number" value={s.weight} onChange={e => subField(s.id, 'weight', e.target.value)} style={{ width: 46, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 800, padding: '9px 0', outline: 'none', textAlign: 'right' }} />
                      <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-3)' }}>%</span>
                    </span>
                  )}
                  <input
                    type="date" value={s.deadline} onChange={e => subField(s.id, 'deadline', e.target.value)}
                    title="Subtask deadline (optional)"
                    style={{ width: 128, flexShrink: 0, padding: '9px 8px', border: '1.5px solid var(--border)', borderRadius: 11, fontSize: 12, fontWeight: 700, background: 'var(--inner-bg)', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  <button onClick={() => removeSub(s.id)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card)', border: '1.5px solid var(--border)', cursor: 'pointer', fontWeight: 800, color: 'var(--text-3)', flexShrink: 0 }}>✕</button>
                </div>

                {/* Subtask assignees — scoped to this task's chosen owners */}
                {subOwners.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 2 }}>
                    {subOwners.map(m => {
                      const on = s.assigneeIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleSubAssignee(s.id, m.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                          background: on ? 'var(--inner-bg)' : 'var(--card)',
                          borderRadius: 999, padding: '3px 9px 3px 3px', cursor: 'pointer',
                          transition: 'all .15s',
                        }}>
                          <span style={{
                            width: 17, height: 17, borderRadius: 5,
                            background: m.color, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 8,
                          }}>{m.initials}</span>
                          <span style={{ fontWeight: 700, fontSize: 11, color: on ? 'var(--text)' : 'var(--text-3)' }}>{m.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ paddingLeft: 2, color: 'var(--text-4)', fontWeight: 700, fontSize: 11 }}>
                    Choose owners above to assign this subtask.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={addSub} style={{
          marginTop: 9, background: 'var(--inner-bg)', border: '1.5px dashed var(--dashed-border)',
          borderRadius: 11, padding: '9px 14px', fontWeight: 800, fontSize: 13,
          cursor: 'pointer', color: 'var(--text-2)', transition: 'border-color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--dashed-border)'}
        >＋ Add subtask</button>

        {form.weighted && (
          <div style={{ marginTop: 10, fontWeight: 800, fontSize: 12, color: weightSum === 100 ? '#5E8A57' : '#C8472F' }}>
            Weights total {weightSum}% — must equal 100%.
          </div>
        )}

        {/* Description */}
        <label style={{ display: 'block', fontWeight: 800, fontSize: 13, margin: '16px 0 7px', color: 'var(--text-2)' }}>Description</label>
        <textarea value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Add detail…" style={{ ...inp, minHeight: 70, resize: 'vertical' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />

        {form.error && <div style={{ color: '#D9614B', fontWeight: 800, fontSize: 13, marginTop: 12 }}>{form.error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={save} style={{
            flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 12, padding: 13, fontWeight: 900, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(224,122,95,.32)',
          }}>{isEdit ? 'Save changes' : 'Create task'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Board page ────────────────────────────────────────────────────────────────
export default function Board() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const location      = useLocation();
  const toast         = useToast();

  const [project, setProject]   = useState(null);
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [perms, setPerms]         = useState({});
  const [blockerPrompt, setBlockerPrompt] = useState(null); // { taskId } while open
  const dragId = useRef(null);

  const load = async () => {
    try {
      const [projRes, tasksRes] = await Promise.all([
        api.get(`/projects?teamId=all`).catch(() => ({ data: [] })),
        api.get(`/tasks?projectId=${projectId}`),
      ]);
      setTasks(tasksRes.data);
      if (tasksRes.data.length) setPerms(tasksRes.data[0].perms || {});
    } finally {
      setLoading(false);
    }
  };

  // Also load project info
  useEffect(() => {
    api.get('/projects').then(r => {
      const p = r.data.find(x => x.id === projectId);
      if (p) { setProject(p); setPerms(p.perms || {}); }
    });
    load();
  }, [projectId]);

  // Open the edit modal when navigated here from Task Detail's "Edit" button
  useEffect(() => {
    if (location.state?.editTask) {
      setEditTask(location.state.editTask);
      setShowModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const moveTask = async (taskId, status, blockedByTeam) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status, blockedByTeam });
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status, blockedByTeam: blockedByTeam || null } : t));
    } catch (err) {
      toast(err.response?.data?.error || 'Could not move task');
    }
  };

  const drop = async (status) => {
    const taskId = dragId.current;
    if (!taskId) return;
    dragId.current = null;

    const current = tasks.find(t => t.id === taskId);
    if (!current || current.status === status) return;

    if (status === 'pending') {
      setBlockerPrompt({ taskId });
      return;
    }
    await moveTask(taskId, status);
  };

  // All statuses always render (even with zero cards) so every column stays a valid drop target.
  const columns = STATUSES.map(s => ({ ...s, cards: tasks.filter(t => t.status === s.key) }));

  const teamId = project?.teamId;

  if (loading) return (
    <>
      <Topbar back={teamId ? `/teams/${teamId}/projects` : '/home'} backLabel="Projects" />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  return (
    <>
      <Topbar back={teamId ? `/teams/${teamId}/projects` : '/home'} backLabel="Projects" />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '26px 2px 18px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-3)', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            {project?.title || 'Project'}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.8px' }}>Board</div>
        </div>
        {perms.create && (
          <button onClick={() => { setEditTask(null); setShowModal(true); }} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '12px 18px', borderRadius: 13,
            fontWeight: 900, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(224,122,95,.32)',
          }}>＋ Create Task</button>
        )}
      </div>

      {perms.edit && (
        <div style={{ margin: '0 2px 14px', fontWeight: 700, fontSize: 12, color: 'var(--text-4)' }}>
          Drag cards between columns to change status.
        </div>
      )}

      {/* Kanban columns */}
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 2px 16px', alignItems: 'flex-start' }}>
        {columns.map(col => (
          <div
            key={col.key}
            onDragOver={e => e.preventDefault()}
            onDrop={() => drop(col.key)}
            style={{
              flexShrink: 0, width: 282,
              background: `color-mix(in srgb, ${col.color} 12%, var(--card))`, border: '1px solid var(--border-2)',
              borderRadius: 18, padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13, padding: '0 4px' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: col.color }} />
              <span style={{ fontWeight: 900, fontSize: 14 }}>{col.label}</span>
              <span style={{
                marginLeft: 'auto', fontWeight: 800, fontSize: 12, color: 'var(--text-3)',
                background: 'var(--card)', borderRadius: 999, padding: '2px 9px',
              }}>{col.cards.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, minHeight: 50 }}>
              {col.cards.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                  onDragStart={() => { dragId.current = task.id; }}
                />
              ))}
              {col.cards.length === 0 && (
                <div style={{
                  border: '1.5px dashed var(--dashed-border)', borderRadius: 12,
                  minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-4)', fontWeight: 700, fontSize: 12,
                }}>
                  Drop here
                </div>
              )}
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div style={{
            background: 'var(--card)', border: '1px dashed var(--border-2)',
            borderRadius: 18, padding: 48, textAlign: 'center',
            color: 'var(--text-3)', fontWeight: 800, minWidth: 280,
          }}>
            No tasks yet{perms.create ? ' — click "Create Task" to add one' : ''}. 🌿
          </div>
        )}
      </div>

      {showModal && (
        <TaskModal
          projectId={projectId}
          projectMembers={project?.members || []}
          editTask={editTask}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {blockerPrompt && (
        <BlockedByModal
          onCancel={() => setBlockerPrompt(null)}
          onConfirm={(team) => { moveTask(blockerPrompt.taskId, 'pending', team); setBlockerPrompt(null); }}
        />
      )}
    </>
  );
}
