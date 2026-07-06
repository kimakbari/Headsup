import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import ProgressRing from '../components/ProgressRing';
import { useToast } from '../components/Toast';
import api from '../api';

export default function Teams() {
  const [teams, setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast    = useToast();

  const load = () =>
    api.get('/teams').then(r => setTeams(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const deleteTeam = async (id, name) => {
    if (!confirm(`Delete team "${name}"? This will also delete all its projects and tasks.`)) return;
    await api.delete(`/teams/${id}`);
    toast('Team deleted');
    load();
  };

  if (loading) return (
    <>
      <Topbar back="/home" backLabel="Home" />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  return (
    <>
      <Topbar back="/home" backLabel="Home" />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '26px 2px 18px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.8px' }}>Teams</div>
          <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 15, marginTop: 3 }}>
            Groups of members with default permissions
          </div>
        </div>
        <button onClick={() => navigate('/teams/new')} style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          padding: '12px 18px', borderRadius: 13,
          fontWeight: 900, fontSize: 14, cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(224,122,95,.32)',
        }}>＋ Add a Team</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {teams.map(team => (
          <div key={team.id} className="anim-pop" style={{
            background: 'var(--card)', border: '1px solid var(--border-2)',
            borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: 20,
          }}>
            <div onClick={() => navigate(`/teams/${team.id}/projects`)} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <ProgressRing pct={0} size={64} r={30} stroke={8} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.3px' }}>{team.name}</div>
                <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>
                  {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Members */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--divider)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {team.members.map(m => {
                const p = m.perms;
                const permLabel = [p.view&&'V',p.edit&&'E',p.create&&'C',p.delete&&'D'].filter(Boolean).join(' ');
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: m.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 11,
                    }}>{m.initials}</span>
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{m.displayName}</span>
                    <span style={{ fontWeight: 800, fontSize: 11, color: 'var(--text-3)', letterSpacing: '.5px' }}>{permLabel}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => navigate(`/teams/${team.id}/projects`)} style={{
                flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
                borderRadius: 11, padding: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                transition: 'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >View projects →</button>
              <button onClick={() => navigate(`/teams/${team.id}/edit`)} style={{
                background: 'var(--card)', border: '1.5px solid var(--border)',
                borderRadius: 11, padding: '9px 13px', fontWeight: 800, fontSize: 13,
                cursor: 'pointer', color: 'var(--text-2)', transition: 'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >Edit</button>
              <button onClick={() => deleteTeam(team.id, team.name)} style={{
                background: 'var(--card)', border: '1.5px solid var(--border)',
                borderRadius: 11, padding: '9px 13px', fontWeight: 800, fontSize: 13,
                cursor: 'pointer', color: '#D9614B', transition: 'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#D9614B'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >Delete</button>
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div style={{
            gridColumn: '1/-1', background: 'var(--card)', border: '1px dashed var(--border-2)',
            borderRadius: 18, padding: 48, textAlign: 'center',
            color: 'var(--text-3)', fontWeight: 800,
          }}>
            No teams yet — click "Add a Team" to get started. 🌿
          </div>
        )}
      </div>
    </>
  );
}
