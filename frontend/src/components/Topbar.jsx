import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fmtDate, daysUntil } from '../utils';
import HamburgerMenu from './HamburgerMenu';
import api from '../api';

// Dismissed notifications are tracked per-tab by a stable key (kind:id), so
// closing one only affects that one — the badge count always reflects exactly
// what's still visible in the banners/dropdown.
const STORAGE_KEY = 'hu_dismissed_notifs';
const loadDismissed = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
};

function urgencyStyle(n) {
  if (n.overdue) return { bg: '#FBE7E1', color: '#C8472F', border: '#F3C7BA' };
  if (daysUntil(n.deadline) <= 3) return { bg: '#FDEBD3', color: '#B0791F', border: '#F0D4A8' };
  return { bg: '#FBF1DD', color: '#8A6A1E', border: '#F0DFB8' };
}

const goTo = n => n.kind === 'subtask'
  ? `/projects/${n.projectId}/tasks/${n.taskId}`
  : `/projects/${n.projectId}/tasks/${n.id}`;

export default function Topbar({ back, backLabel }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [bellOpen, setBellOpen]   = useState(false);
  const [tasksDue, setTasksDue]       = useState([]);
  const [subtasksDue, setSubtasksDue] = useState([]);
  const [dismissed, setDismissed]     = useState(loadDismissed);

  useEffect(() => {
    api.get('/tasks/notifications/upcoming')
      .then(r => {
        setTasksDue(r.data.tasks || []);
        setSubtasksDue(r.data.subtasks || []);
      })
      .catch(() => {});
  }, []);

  const dismissOne = (key) => {
    setDismissed(d => {
      const next = new Set(d);
      next.add(key);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const visibleTasks    = tasksDue.map(n => ({ ...n, kind: 'task', key: `t:${n.id}` })).filter(n => !dismissed.has(n.key));
  const visibleSubtasks = subtasksDue.map(n => ({ ...n, kind: 'subtask', key: `s:${n.id}` })).filter(n => !dismissed.has(n.key));
  const allVisible      = [...visibleTasks, ...visibleSubtasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const taskOverdue    = visibleTasks.filter(n => n.overdue).length;
  const subtaskOverdue = visibleSubtasks.filter(n => n.overdue).length;
  const taskDueSoon    = visibleTasks.filter(n => !n.overdue && daysUntil(n.deadline) <= 3).length;
  const subtaskDueSoon = visibleSubtasks.filter(n => !n.overdue && daysUntil(n.deadline) <= 3).length;
  const totalCount     = allVisible.length;

  const taskSummary = visibleTasks.length
    ? `${visibleTasks.length} task${visibleTasks.length !== 1 ? 's' : ''} due within a week`
      + (taskDueSoon ? ` · ${taskDueSoon} within 3 days` : '')
      + (taskOverdue ? ` · ${taskOverdue} overdue` : '')
    : null;
  const subtaskSummary = visibleSubtasks.length
    ? `${visibleSubtasks.length} subtask${visibleSubtasks.length !== 1 ? 's' : ''} due within a week`
      + (subtaskDueSoon ? ` · ${subtaskDueSoon} within 3 days` : '')
      + (subtaskOverdue ? ` · ${subtaskOverdue} overdue` : '')
    : null;

  const banners = [
    { type: 'tasks',    summary: taskSummary,    items: visibleTasks },
    { type: 'subtasks', summary: subtaskSummary, items: visibleSubtasks },
  ].filter(b => b.summary);

  const landingPath = user?.isAdmin ? '/home' : '/my-tasks';

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--topbar-bg)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 0', marginBottom: 6,
        borderBottom: '1px solid var(--border-2)',
      }}>
        {/* Logo */}
        <div onClick={() => navigate(landingPath)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 18,
          }}>H</div>
          <span style={{ fontWeight: 900, fontSize: 19, letterSpacing: '-.5px' }}>Heads up</span>
        </div>

        {/* Back button */}
        {back && (
          <button onClick={() => navigate(back)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--card)', border: '1.5px solid var(--border)',
            borderRadius: 11, padding: '7px 13px',
            fontWeight: 800, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)',
            transition: 'border-color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            ← {backLabel}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Notification bell + dropdown */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setBellOpen(o => !o)} title="Notifications" style={{
            position: 'relative', width: 40, height: 40, borderRadius: 12,
            background: 'var(--card)', border: '1.5px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, transition: 'border-color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            🔔
            {totalCount > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5,
                minWidth: 19, height: 19, padding: '0 5px',
                borderRadius: 999, background: '#D9614B', color: '#fff',
                fontSize: 11, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg)',
              }}>
                {totalCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <>
              <div onClick={() => setBellOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{
                position: 'absolute', top: 48, right: 0, width: 340, maxHeight: 440,
                overflowY: 'auto', background: 'var(--card)', border: '1.5px solid var(--border)',
                borderRadius: 16, boxShadow: '0 20px 50px rgba(44,39,34,.18)',
                zIndex: 50, padding: 8,
              }}>
                <div style={{ fontWeight: 900, fontSize: 14, padding: '8px 8px 10px' }}>
                  Notifications{totalCount > 0 ? ` (${totalCount})` : ''}
                </div>
                {allVisible.length === 0 && (
                  <div style={{ padding: '18px 8px 22px', textAlign: 'center', color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>
                    You're all caught up. 🌿
                  </div>
                )}
                {allVisible.map(n => (
                  <div key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 11 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--inner-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div
                      onClick={() => { setBellOpen(false); navigate(goTo(n)); }}
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: n.overdue ? '#C8472F' : 'var(--text-3)' }}>
                        {n.kind === 'subtask' ? `${n.taskTitle} · ` : ''}{fmtDate(n.deadline)}{n.overdue ? ' · overdue' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => dismissOne(n.key)}
                      title="Dismiss"
                      style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: 7,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', fontWeight: 900, fontSize: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* User pill */}
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '5px 6px 5px 12px',
            background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 13,
          }}>
            <span style={{ lineHeight: 1.05, textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 13 }}>{user.displayName}</span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 11, color: 'var(--text-3)' }}>
                {user.isAdmin ? 'Admin' : 'Team member'}
              </span>
            </span>
            <span style={{
              width: 32, height: 32, borderRadius: 10,
              background: user.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13,
            }}>
              {user.initials}
            </span>
          </div>
        )}

        {/* Hamburger */}
        <button onClick={() => setMenuOpen(true)} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: 4,
          alignItems: 'center', justifyContent: 'center',
          transition: 'filter .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.05)'}
        onMouseLeave={e => e.currentTarget.style.filter = 'none'}
        >
          <span style={{ width: 18, height: 2.5, background: '#fff', borderRadius: 2 }} />
          <span style={{ width: 18, height: 2.5, background: '#fff', borderRadius: 2 }} />
          <span style={{ width: 18, height: 2.5, background: '#fff', borderRadius: 2 }} />
        </button>
      </div>

      {/* Notification banners — one for tasks, one for subtasks; each item closes individually */}
      {banners.map(b => (
        <div key={b.type} className="anim-fade" style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: 'var(--banner-bg)', border: '1.5px solid var(--banner-border)',
          borderRadius: 14, padding: '13px 16px', margin: '0 0 12px',
        }}>
          <span style={{ fontSize: 18, marginTop: 1 }}>⏰</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--banner-text)', marginBottom: 9 }}>{b.summary}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {b.items.map(n => {
                const style = urgencyStyle(n);
                return (
                  <span
                    key={n.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: style.bg, color: style.color,
                      border: `1.5px solid ${style.border}`,
                      borderRadius: 999, padding: '5px 6px 5px 11px',
                      fontWeight: 800, fontSize: 12,
                    }}
                  >
                    <span
                      onClick={() => navigate(goTo(n))}
                      title={n.taskTitle ? `${n.title} — ${n.taskTitle}` : n.title}
                      style={{
                        cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', maxWidth: 190,
                      }}
                    >
                      {n.title}{n.taskTitle ? ` — ${n.taskTitle}` : ''}
                      <span style={{ opacity: .8 }}> · {fmtDate(n.deadline)}</span>
                    </span>
                    <button
                      onClick={() => dismissOne(n.key)}
                      title="Dismiss"
                      style={{
                        flexShrink: 0, width: 17, height: 17, borderRadius: '50%',
                        background: 'rgba(0,0,0,.08)', border: 'none', cursor: 'pointer',
                        color: style.color, fontWeight: 900, fontSize: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {menuOpen && <HamburgerMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}
