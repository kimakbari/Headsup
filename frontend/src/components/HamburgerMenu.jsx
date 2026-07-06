import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

export default function HamburgerMenu({ onClose }) {
  const { user, logout }      = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    api.get('/teams').then(r => setTeams(r.data)).catch(() => {});
  }, []);

  const go = (path) => { navigate(path); onClose(); };

  const landingPath  = user?.isAdmin ? '/home' : '/my-tasks';
  const landingLabel = user?.isAdmin ? 'All Projects' : 'My Tasks';

  const btn = (onClick, children, extra = {}) => (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 11,
      background: 'var(--card)', border: '1.5px solid var(--border)',
      borderRadius: 13, padding: '12px 15px',
      fontWeight: 800, fontSize: 14, cursor: 'pointer',
      transition: 'border-color .15s',
      ...extra,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = extra.borderColor || 'var(--border)'}
    >
      {children}
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="anim-fade" style={{
        position: 'fixed', inset: 0,
        background: 'rgba(44,39,34,.34)',
        backdropFilter: 'blur(2px)', zIndex: 60,
      }} />

      {/* Drawer */}
      <div className="anim-drawer" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 330, maxWidth: '86vw',
        background: 'var(--bg)', zIndex: 61,
        boxShadow: '-12px 0 40px rgba(44,39,34,.18)',
        padding: 24, overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-.4px' }}>Menu</span>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'var(--card)', border: '1.5px solid var(--border)',
            cursor: 'pointer', fontSize: 17, fontWeight: 800,
          }}>✕</button>
        </div>

        {/* Theme toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 11,
          background: 'var(--card)', border: '1.5px solid var(--border)',
          borderRadius: 13, padding: '12px 15px', marginBottom: 10,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 800, fontSize: 14 }}>
            <span>{theme === 'dark' ? '🌙' : '☀️'}</span> {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </span>
          <span onClick={toggleTheme} role="switch" aria-checked={theme === 'dark'} style={{
            width: 42, height: 24, borderRadius: 999, cursor: 'pointer',
            background: theme === 'dark' ? 'var(--accent)' : 'var(--dashed-border)',
            position: 'relative', transition: 'background .2s', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: 2,
              left: theme === 'dark' ? 20 : 2,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
              boxShadow: '0 1px 3px rgba(0,0,0,.25)',
            }} />
          </span>
        </div>

        {/* Home */}
        {btn(() => go(landingPath), <><span>🏠</span> {landingLabel}</>, { marginBottom: 10 })}

        {/* Teams section */}
        <div style={{
          fontWeight: 900, fontSize: 12, color: 'var(--text-4)',
          textTransform: 'uppercase', letterSpacing: '.6px',
          margin: '18px 4px 10px',
        }}>
          Teams
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teams.map(t => (
            <button key={t.id} onClick={() => go(`/teams/${t.id}/projects`)} style={{
              width: '100%', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 11,
              background: 'var(--card)', border: '1.5px solid var(--border)',
              borderRadius: 13, padding: '12px 15px',
              fontWeight: 800, fontSize: 14, cursor: 'pointer',
              transition: 'border-color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              {t.name}
            </button>
          ))}
          {teams.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, padding: '6px 4px' }}>
              No teams yet
            </div>
          )}
        </div>

        {/* Admin section */}
        {user?.isAdmin && (
          <>
            <div style={{
              fontWeight: 900, fontSize: 12, color: 'var(--text-4)',
              textTransform: 'uppercase', letterSpacing: '.6px',
              margin: '20px 4px 10px',
            }}>
              Admin
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {btn(() => go('/teams'),        <><span>👥</span> Manage Teams</>)}
              {btn(() => go('/members'),      <><span>🧑</span> Members</>)}
              <button onClick={() => go('/members/new')} style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 11,
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 13, padding: '12px 15px',
                fontWeight: 900, fontSize: 14, cursor: 'pointer',
                filter: 'none', transition: 'filter .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.05)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                <span>＋</span> Create Member
              </button>
            </div>
          </>
        )}

        {/* Logout */}
        <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px dashed var(--dashed-border)' }}>
          <button onClick={async () => { await logout(); navigate('/login'); }} style={{
            width: '100%', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 11,
            background: 'var(--card)', border: '1.5px solid var(--border)',
            borderRadius: 13, padding: '13px 15px',
            fontWeight: 800, fontSize: 15, cursor: 'pointer',
            color: '#D9614B', transition: 'border-color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#D9614B'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span>⏻</span> Log out
          </button>
        </div>
      </div>
    </>
  );
}
