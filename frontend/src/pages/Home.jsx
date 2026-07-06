import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import ProgressRing from '../components/ProgressRing';
import TeamBadge from '../components/TeamBadge';
import api from '../api';

export default function Home() {
  const [teams, setTeams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects/home').then(r => setTeams(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      <Topbar />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  const q = search.trim().toLowerCase();
  const visibleTeams = q
    ? teams
        .map(team => ({ ...team, projects: team.projects.filter(p => p.title.toLowerCase().includes(q)) }))
        .filter(team => team.projects.length > 0)
    : teams;

  return (
    <>
      <Topbar />

      <div style={{ padding: '26px 2px 8px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.8px' }}>All Projects</div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 15, marginTop: 3 }}>
          Progress across every team and project
        </div>
      </div>

      <div style={{ position: 'relative', margin: '4px 2px 20px', maxWidth: 420 }}>
        <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-3)' }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
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

      {teams.length === 0 && (
        <div style={{
          background: 'var(--card)', border: '1px dashed var(--border-2)',
          borderRadius: 18, padding: 48, textAlign: 'center',
          color: 'var(--text-3)', fontWeight: 800, marginTop: 12,
        }}>
          No teams yet. Create one from the menu. 🌿
        </div>
      )}

      {teams.length > 0 && visibleTeams.length === 0 && (
        <div style={{
          background: 'var(--card)', border: '1px dashed var(--border-2)',
          borderRadius: 18, padding: 48, textAlign: 'center',
          color: 'var(--text-3)', fontWeight: 800, marginTop: 12,
        }}>
          No projects match "{search.trim()}". 🌿
        </div>
      )}

      {visibleTeams.map(team => (
        <div key={team.id} className="anim-pop" style={{
          background: 'var(--card)',
          border: '1px solid var(--border-2)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* Team icon + name */}
            <div
              onClick={() => navigate(`/teams/${team.id}/projects`)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', minWidth: 220 }}
            >
              <TeamBadge name={team.name} color={team.color} icon={team.icon} size={52} radius={14} />
              <div>
                <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.5px' }}>{team.name}</div>
                <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                  {team.projects.length} project{team.projects.length !== 1 ? 's' : ''}
                </div>
                {/* Member avatars */}
                <div style={{ display: 'flex', marginTop: 9 }}>
                  {team.avatars.map((a, i) => (
                    <span key={i} style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: a.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 11,
                      marginRight: -6, border: '2px solid var(--card)',
                    }}>{a.initials}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ height: 88, width: 1, background: 'var(--inner-border)' }} />

            {/* Project rings */}
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', flex: 1 }}>
              {team.projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}/board`)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    cursor: 'pointer', textAlign: 'center', width: 108, transition: 'transform .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <ProgressRing pct={p.progress} size={72} r={30} stroke={7} />
                  <div style={{ fontWeight: 800, fontSize: 13, marginTop: 8, lineHeight: 1.2 }}>{p.title}</div>
                </div>
              ))}
              {team.projects.length === 0 && (
                <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, alignSelf: 'center' }}>
                  No projects yet
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
