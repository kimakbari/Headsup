import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import ProgressRing from '../components/ProgressRing';
import { fmtDate, deadlineColor } from '../utils';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function TeamProjects() {
  const { teamId }    = useParams();
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const [team, setTeam]         = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      const [teamsRes, projRes] = await Promise.all([
        api.get('/teams'),
        api.get(`/projects?teamId=${teamId}`),
      ]);
      const found = teamsRes.data.find(t => t.id === teamId);
      setTeam(found || null);
      setProjects(projRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [teamId]);

  const myTeamPerms  = team?.members.find(m => m.id === user?.id)?.perms;
  const canCreate    = user?.isAdmin || (myTeamPerms?.edit && myTeamPerms?.create);

  if (loading) return (
    <>
      <Topbar back="/teams" backLabel="Teams" />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  return (
    <>
      <Topbar back="/teams" backLabel="Teams" />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '26px 2px 18px', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-3)', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            {team?.name || '…'} team
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.8px' }}>Projects</div>
        </div>
        {canCreate && (
          <button onClick={() => navigate(`/teams/${teamId}/projects/new`)} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '12px 18px', borderRadius: 13,
            fontWeight: 900, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(224,122,95,.32)',
          }}>＋ Create Project</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {projects.map(p => (
          <div
            key={p.id}
            onClick={() => navigate(`/projects/${p.id}/board`)}
            className="anim-pop"
            style={{
              position: 'relative',
              background: 'var(--card)', border: '1px solid var(--border-2)',
              borderRadius: 18, boxShadow: 'var(--shadow-md)',
              padding: 20, cursor: 'pointer',
              transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(44,39,34,.09)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          >
            {user?.isAdmin && (
              <button
                onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}/edit`); }}
                title="Edit project"
                style={{
                  position: 'absolute', top: 14, right: 14, zIndex: 1,
                  width: 32, height: 32, borderRadius: 9,
                  background: 'var(--card)', border: '1.5px solid var(--border)',
                  cursor: 'pointer', fontSize: 14, color: 'var(--text-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >✎</button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ProgressRing pct={p.progress} size={56} r={24} stroke={6} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-.3px', lineHeight: 1.2, paddingRight: user?.isAdmin ? 34 : 0 }}>{p.title}</div>
                <div style={{ color: deadlineColor(p.deadline, ''), fontWeight: 800, fontSize: 12, marginTop: 4 }}>
                  📅 Due {fmtDate(p.deadline)}
                </div>
              </div>
            </div>

            {p.description && (
              <p style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: 13, lineHeight: 1.5, margin: '14px 0 0' }}>
                {p.description}
              </p>
            )}

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex' }}>
                {p.members.slice(0, 4).map((m, i) => (
                  <span key={i} style={{
                    width: 24, height: 24, borderRadius: 7,
                    background: m.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 10,
                    marginRight: -5, border: '2px solid var(--card)',
                  }}>{m.initials}</span>
                ))}
              </div>
              <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-3)' }}>
                {p.taskCount} task{p.taskCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div style={{
            gridColumn: '1/-1', background: 'var(--card)', border: '1px dashed var(--border-2)',
            borderRadius: 18, padding: 48, textAlign: 'center',
            color: 'var(--text-3)', fontWeight: 800,
          }}>
            No projects yet{canCreate ? ' — click "Create Project" to add one' : ''}. 🌿
          </div>
        )}
      </div>
    </>
  );
}
