import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import BlockedByModal from '../components/BlockedByModal';
import MoveTaskModal from '../components/MoveTaskModal';
import { STATUSES, statusMeta, prioMeta, fmtDate, deadlineColor, timeAgo } from '../utils';
import { useToast } from '../components/Toast';
import api from '../api';

// Matches an in-progress "@fragment" ending at the cursor, e.g. "hey @sar" → "sar"
const MENTION_PATTERN = /(?:^|\s)@([^\s@]*)$/;

export default function TaskDetail() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const toast    = useToast();

  const [task, setTask]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [newSub, setNewSub]     = useState('');
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting]   = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [blockerPrompt, setBlockerPrompt] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [teamProjects, setTeamProjects] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // string while the @ dropdown should show
  const [mentionedIds, setMentionedIds] = useState([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moving, setMoving] = useState(false);
  const commentInputRef = useRef(null);

  const load = () => api.get(`/tasks/${taskId}`).then(r => setTask(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, [taskId]);

  useEffect(() => {
    api.get('/projects').then(r => {
      const p = r.data.find(x => x.id === projectId);
      setProjectMembers(p?.members || []);
      if (p?.teamId) {
        api.get(`/projects?teamId=${p.teamId}`)
          .then(r2 => setTeamProjects(r2.data.filter(tp => tp.id !== projectId)))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [projectId]);

  const toggleSub = async (sub) => {
    if (!task?.perms?.edit) return;
    await api.put(`/tasks/${taskId}/subtasks/${sub.id}`, { done: !sub.done });
    load();
  };

  const addSub = async () => {
    if (!newSub.trim()) return;
    await api.post(`/tasks/${taskId}/subtasks`, { title: newSub.trim() });
    setNewSub('');
    load();
  };

  const changeStatus = async (status, blockedByTeam) => {
    await api.put(`/tasks/${taskId}/status`, { status, blockedByTeam });
    load();
    toast('Status updated');
  };

  const onStatusSelect = (status) => {
    if (status === 'pending') { setBlockerPrompt(true); return; }
    changeStatus(status);
  };

  const deleteTask = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await api.delete(`/tasks/${taskId}`);
    toast('Task deleted');
    navigate(`/projects/${projectId}/board`);
  };

  const moveTask = async (newProjectId) => {
    setMoving(true);
    try {
      await api.put(`/tasks/${taskId}/move`, { projectId: newProjectId });
      toast('Task moved');
      navigate(`/projects/${newProjectId}/board`);
    } catch (err) {
      toast(err.response?.data?.error || 'Could not move task');
    } finally {
      setMoving(false);
      setShowMoveModal(false);
    }
  };

  const duplicateTask = async () => {
    if (!task || duplicating) return;
    setDuplicating(true);
    try {
      await api.post('/tasks', {
        projectId,
        title:       `${task.title} (copy)`,
        ownerIds:    task.owners?.map(o => o.id) || [],
        deadline:    task.deadline || '',
        priority:    task.priority,
        description: task.description || '',
        weighted:    task.weighted,
        subtasks: task.subtasks?.map(s => ({
          title:       s.title,
          done:        false,
          weight:      s.weight,
          deadline:    s.deadline || '',
          assigneeIds: s.assignees?.map(a => a.id) || [],
        })) || [],
      });
      toast('Task duplicated');
      navigate(`/projects/${projectId}/board`);
    } catch (err) {
      toast(err.response?.data?.error || 'Could not duplicate task');
    } finally {
      setDuplicating(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || posting) return;
    setPosting(true);
    try {
      await api.post(`/tasks/${taskId}/comments`, { body: newComment.trim(), mentionedIds });
      setNewComment('');
      setMentionedIds([]);
      setMentionQuery(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not post comment');
    } finally {
      setPosting(false);
    }
  };

  const onCommentChange = (e) => {
    const val = e.target.value;
    setNewComment(val);
    const uptoCursor = val.slice(0, e.target.selectionStart);
    const match = uptoCursor.match(MENTION_PATTERN);
    setMentionQuery(match ? match[1] : null);
  };

  const mentionMatches = mentionQuery !== null
    ? projectMembers.filter(m => m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const pickMention = (m) => {
    const input = commentInputRef.current;
    const cursor = input ? input.selectionStart : newComment.length;
    const before = newComment.slice(0, cursor).replace(MENTION_PATTERN, (match) => {
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return `${leadingSpace}@${m.displayName} `;
    });
    const after = newComment.slice(cursor);
    setNewComment(before + after);
    setMentionedIds(ids => ids.includes(m.id) ? ids : [...ids, m.id]);
    setMentionQuery(null);
    setTimeout(() => input?.focus(), 0);
  };

  const onAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await api.post(`/uploads/${taskId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    toast('File attached');
    load();
  };

  if (loading) return (
    <>
      <Topbar back={`/projects/${projectId}/board`} backLabel="Board" />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );
  if (!task) return (
    <>
      <Topbar back={`/projects/${projectId}/board`} backLabel="Board" />
      <div style={{ color: '#D9614B', fontWeight: 800, padding: 40 }}>Task not found.</div>
    </>
  );

  const pm = prioMeta(task.priority);
  const sm = statusMeta(task.status);
  const done = task.subtasks?.filter(s => s.done).length || 0;
  const wsum = task.subtasks?.reduce((a, s) => a + (s.weight || 0), 0) || 0;

  const card = {
    background: 'var(--card)', border: '1px solid var(--border-2)',
    borderRadius: 20, boxShadow: 'var(--shadow-lg)', padding: 26,
  };

  const metaLabel = {
    fontWeight: 800, fontSize: 11, color: 'var(--text-4)',
    textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6,
  };

  return (
    <>
      <Topbar back={`/projects/${projectId}/board`} backLabel="Board" />

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, paddingTop: 22, alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div className="anim-pop" style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontWeight: 800, fontSize: 11, padding: '3px 10px',
                  borderRadius: 999, color: pm.color, background: pm.bg,
                }}>{task.priority} priority</span>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontWeight: 800, fontSize: 12, color: 'var(--text-2)',
                  background: 'var(--divider)', borderRadius: 999, padding: '4px 11px',
                }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: sm.color }} />
                  {sm.label}{task.status === 'pending' && task.blockedByTeam ? ` · ${task.blockedByTeam}` : ''}
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.6px', lineHeight: 1.15 }}>
                {task.title}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {task.perms?.edit && (
                <button onClick={() => navigate(`/projects/${projectId}/board`, { state: { editTask: task } })} style={{
                  background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
                  borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >Edit</button>
              )}
              {task.perms?.create && (
                <button onClick={duplicateTask} disabled={duplicating} style={{
                  background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
                  borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13,
                  cursor: duplicating ? 'not-allowed' : 'pointer', opacity: duplicating ? .6 : 1,
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >{duplicating ? 'Duplicating…' : 'Duplicate'}</button>
              )}
              {task.perms?.edit && teamProjects.length > 0 && (
                <button onClick={() => setShowMoveModal(true)} style={{
                  background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
                  borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >Move to</button>
              )}
              {task.perms?.delete && (
                <button onClick={deleteTask} style={{
                  background: 'var(--card)', border: '1.5px solid var(--border)',
                  borderRadius: 11, padding: '9px 15px', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer', color: '#D9614B', transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#D9614B'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >Delete</button>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', margin: '22px 0', padding: '16px 0', borderTop: '1px solid var(--divider)', borderBottom: '1px solid var(--divider)' }}>
            <div>
              <div style={metaLabel}>Owners</div>
              {task.owners?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {task.owners.map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: o.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 12,
                      }}>{o.initials}</span>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{o.displayName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-3)' }}>Unassigned</span>
              )}
            </div>
            <div>
              <div style={metaLabel}>Deadline</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: deadlineColor(task.deadline, task.status) }}>
                📅 {fmtDate(task.deadline)}
              </div>
            </div>
            <div>
              <div style={metaLabel}>Progress</div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{task.progress}%</div>
            </div>
            {task.status === 'pending' && task.blockedByTeam && (
              <div>
                <div style={metaLabel}>Blocked by</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: sm.color }}>🚧 {task.blockedByTeam}</div>
              </div>
            )}
            {task.perms?.edit && (
              <div>
                <div style={metaLabel}>Move to</div>
                <select value={task.status} onChange={e => onStatusSelect(e.target.value)} style={{
                  border: '1.5px solid var(--border)', borderRadius: 10,
                  padding: '7px 10px', fontWeight: 800, fontSize: 13,
                  background: 'var(--card)', cursor: 'pointer', outline: 'none',
                }}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              Subtasks{' '}
              <span style={{ color: 'var(--text-3)', fontWeight: 800, fontSize: 13 }}>{done}/{task.subtasks?.length || 0}</span>
            </div>
            {task.weighted && (
              <span style={{
                fontWeight: 800, fontSize: 11,
                color: wsum === 100 ? '#5E8A57' : '#C8472F',
                background: 'var(--divider)', borderRadius: 999, padding: '4px 11px',
              }}>
                Weighted · {wsum}%
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ height: 9, borderRadius: 999, background: 'var(--inner-border)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', borderRadius: 999, background: sm.color, width: `${task.progress}%`, transition: 'width .3s' }} />
          </div>

          {/* Subtask list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {task.subtasks?.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                background: 'var(--inner-bg)', border: '1px solid var(--inner-border)',
                borderRadius: 12, padding: '11px 13px',
              }}>
                <span
                  onClick={() => toggleSub(s)}
                  style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    border: `2px solid ${s.done ? sm.color : 'var(--checkbox-border)'}`,
                    background: s.done ? sm.color : 'var(--card)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900,
                    cursor: task.perms?.edit ? 'pointer' : 'default',
                  }}
                >{s.done ? '✓' : ''}</span>
                <span style={{
                  flex: 1, fontWeight: 700, fontSize: 14,
                  color: s.done ? 'var(--text-3)' : 'var(--text)',
                  textDecoration: s.done ? 'line-through' : 'none',
                }}>{s.title}</span>
                {s.deadline && (
                  <span style={{ fontWeight: 800, fontSize: 11, color: deadlineColor(s.deadline, s.done ? 'done' : '') }}>
                    📅 {fmtDate(s.deadline)}
                  </span>
                )}
                {s.assignees?.length > 0 && (
                  <span style={{ display: 'flex' }}>
                    {s.assignees.map((a, i) => (
                      <span key={a.id} title={a.displayName} style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: a.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 9,
                        marginLeft: i > 0 ? -5 : 0, border: '2px solid var(--inner-bg)',
                      }}>{a.initials}</span>
                    ))}
                  </span>
                )}
                {task.weighted && (
                  <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-3)' }}>{s.weight}%</span>
                )}
              </div>
            ))}
          </div>

          {/* Add subtask inline */}
          {task.perms?.edit && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={newSub}
                onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSub()}
                placeholder="Add a subtask…"
                style={{
                  flex: 1, padding: '10px 13px',
                  border: '1.5px solid var(--border)', borderRadius: 11,
                  fontSize: 13, fontWeight: 700, background: 'var(--card)', outline: 'none',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button onClick={addSub} style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                width: 42, borderRadius: 11, fontWeight: 900, fontSize: 20, cursor: 'pointer',
              }}>＋</button>
            </div>
          )}

          {/* Description */}
          <div style={{ fontWeight: 900, fontSize: 16, margin: '24px 0 8px' }}>Description</div>
          <p style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: 14, lineHeight: 1.65, margin: 0 }}>
            {task.description || 'No description.'}
          </p>

          {/* Attachments */}
          <div style={{ fontWeight: 900, fontSize: 16, margin: '24px 0 10px' }}>Attachments</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {task.attachments?.map(a => (
              <a
                key={a.id}
                href={`/uploads/${a.storedName}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: 'var(--inner-bg)', border: '1px solid var(--inner-border)',
                  borderRadius: 12, padding: '10px 13px',
                  fontWeight: 800, fontSize: 13, textDecoration: 'none', color: 'var(--text)',
                }}
              >📎 {a.originalName}</a>
            ))}
            {!task.attachments?.length && (
              <span style={{ color: 'var(--text-4)', fontWeight: 700, fontSize: 13 }}>No attachments yet.</span>
            )}
            {task.perms?.edit && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--card)', border: '1.5px dashed var(--dashed-border)', borderRadius: 12,
                padding: '10px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)',
                transition: 'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--dashed-border)'}
              >
                ＋ Attach file
                <input type="file" onChange={onAttach} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        {/* ── Right column: Activity ── */}
        <div className="anim-pop" style={{ ...card, animationDelay: '.05s' }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {task.activity?.map((a, i) => (
              <div key={a.id || i} style={{ display: 'flex', gap: 11 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                  {i < task.activity.length - 1 && <span style={{ width: 2, flex: 1, background: 'var(--inner-border)' }} />}
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 900 }}>{a.memberName}</span>{' '}{a.action}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                    {timeAgo(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {!task.activity?.length && (
              <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>No activity yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Comments ── */}
      <div className="anim-pop" style={{ ...card, marginTop: 20, animationDelay: '.08s' }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>
          Comments{' '}
          <span style={{ color: 'var(--text-3)', fontWeight: 800, fontSize: 13 }}>{task.comments?.length || 0}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          {task.comments?.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: c.memberColor, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 12,
              }}>{c.memberInitials}</span>
              <div style={{
                flex: 1, background: 'var(--inner-bg)', border: '1px solid var(--inner-border)',
                borderRadius: 12, padding: '10px 13px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 13 }}>{c.memberName}</span>
                  <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-4)' }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
                  {c.body}
                </div>
              </div>
            </div>
          ))}
          {!task.comments?.length && (
            <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>No comments yet — start the conversation.</div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          {mentionMatches.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
              width: 220, maxHeight: 190, overflowY: 'auto',
              background: 'var(--card)', border: '1.5px solid var(--border)',
              borderRadius: 12, boxShadow: '0 12px 30px rgba(44,39,34,.18)',
              zIndex: 20, padding: 6,
            }}>
              {mentionMatches.map(m => (
                <div
                  key={m.id}
                  onMouseDown={e => { e.preventDefault(); pickMention(m); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 9, cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--inner-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    background: m.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 10,
                  }}>{m.initials}</span>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{m.displayName}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={commentInputRef}
              value={newComment}
              onChange={onCommentChange}
              onKeyDown={e => e.key === 'Enter' && !mentionMatches.length && addComment()}
              placeholder="Write a comment… use @ to mention someone"
              style={{
                flex: 1, padding: '10px 13px',
                border: '1.5px solid var(--border)', borderRadius: 11,
                fontSize: 13, fontWeight: 700, background: 'var(--card)', outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button onClick={addComment} disabled={posting || !newComment.trim()} style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              padding: '10px 18px', borderRadius: 11, fontWeight: 800, fontSize: 13,
              cursor: posting || !newComment.trim() ? 'not-allowed' : 'pointer',
              opacity: posting || !newComment.trim() ? .6 : 1,
            }}>Post</button>
          </div>

          {mentionedIds.length > 0 && (
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 12, color: 'var(--text-3)' }}>
              Will notify: {projectMembers.filter(m => mentionedIds.includes(m.id)).map(m => m.displayName).join(', ')}
            </div>
          )}
        </div>
      </div>

      {blockerPrompt && (
        <BlockedByModal
          onCancel={() => setBlockerPrompt(false)}
          onConfirm={(team) => { changeStatus('pending', team); setBlockerPrompt(false); }}
        />
      )}

      {showMoveModal && (
        <MoveTaskModal
          projects={teamProjects}
          moving={moving}
          onCancel={() => setShowMoveModal(false)}
          onConfirm={moveTask}
        />
      )}
    </>
  );
}
