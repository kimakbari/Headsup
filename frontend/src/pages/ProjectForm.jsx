import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const PERM_COLORS = { view: '#5FA8A0', edit: '#E2B25E', create: '#9B86C4', delete: '#D9614B' };

function PermPill({ label, active, color, onClick }) {
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 30, borderRadius: 9,
      fontWeight: 900, fontSize: 12, cursor: 'pointer',
      border: `1.5px solid ${active ? color : 'var(--dashed-border)'}`,
      background: active ? color : 'var(--card)',
      color: active ? '#fff' : 'var(--text-3)',
      transition: 'all .15s',
    }}>{label}</span>
  );
}

export default function ProjectForm() {
  const { teamId: teamIdParam, projectId } = useParams();
  const isEdit     = !!projectId;
  const navigate   = useNavigate();
  const toast      = useToast();
  const { user }   = useAuth();

  const [team, setTeam]       = useState(null);
  const [teamId, setTeamId]   = useState(teamIdParam || null);
  const [form, setForm]       = useState({ title: '', deadline: '', description: '' });
  const [picks, setPicks]     = useState({});
  const [roster, setRoster]   = useState([]);   // team members (with their info)
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    Promise.all([
      api.get('/teams'),
      api.get('/members'),
      isEdit ? api.get('/projects') : Promise.resolve(null),
    ]).then(([teamsRes, membersRes, projectsRes]) => {
      const project = projectsRes?.data.find(p => p.id === projectId);
      const resolvedTeamId = isEdit ? project?.teamId : teamIdParam;
      const t = teamsRes.data.find(x => x.id === resolvedTeamId);
      setTeam(t);
      setTeamId(resolvedTeamId || null);

      if (isEdit && project) {
        setForm({
          title:       project.title,
          deadline:    project.deadline ? project.deadline.slice(0, 10) : '',
          description: project.description || '',
        });
      }

      if (t) {
        // roster = team members mapped to full member info, excluding members who
        // already have edit+create permission on the team — they can create projects
        // themselves, so they already have full access to every project on this team.
        const allMembers = membersRes.data;
        const creatorIds = new Set(t.members.filter(tm => tm.perms.edit && tm.perms.create).map(tm => tm.id));
        const teamMemberIds = t.members.map(m => m.id).filter(id => !creatorIds.has(id));
        const ros = allMembers.filter(m => teamMemberIds.includes(m.id));
        setRoster(ros);

        const p = {};
        t.members.filter(tm => !creatorIds.has(tm.id)).forEach(tm => {
          const existing = project?.members.find(pm => pm.id === tm.id);
          p[tm.id] = existing
            ? { selected: true, ...existing.perms }
            : {
                selected: false,
                view:     tm.perms.view,
                edit:     tm.perms.edit,
                create:   tm.perms.create,
                delete:   tm.perms.delete,
              };
        });
        setPicks(p);
      }
    }).finally(() => setLoading(false));
  }, [teamIdParam, projectId]);

  const set = p => setForm(f => ({ ...f, ...p }));

  const toggleSel = (id) => setPicks(p => ({ ...p, [id]: { ...p[id], selected: !p[id].selected } }));

  const togglePerm = (id, key) => {
    setPicks(p => {
      const cur = { ...p[id] };
      cur[key] = !cur[key];
      if (key === 'view' && !cur.view) { cur.edit = false; cur.create = false; cur.delete = false; }
      if (key !== 'view' && cur[key])  { cur.view = true; }
      return { ...p, [id]: cur };
    });
  };

  const save = async () => {
    if (!form.title.trim()) { setError('Give the project a title.'); return; }
    if (!form.deadline)     { setError('Pick a deadline.'); return; }
    const chosen = roster.filter(m => picks[m.id]?.selected);
    if (roster.length > 0 && !chosen.length) { setError('Add at least one member.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        teamId,
        title:       form.title.trim(),
        deadline:    form.deadline,
        description: form.description.trim() || null,
        members: chosen.map(m => ({
          memberId: m.id,
          perms: {
            view:   picks[m.id].view,
            edit:   picks[m.id].edit,
            create: picks[m.id].create,
            delete: picks[m.id].delete,
          },
        })),
      };
      if (isEdit) {
        await api.put(`/projects/${projectId}`, payload);
        toast('Project updated');
      } else {
        await api.post('/projects', payload);
        toast('Project created');
      }
      navigate(`/teams/${teamId}/projects`);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <>
      <Topbar back="/teams" backLabel="Teams" />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  const myTeamPerms = team?.members.find(m => m.id === user?.id)?.perms;
  const canCreate   = user?.isAdmin || (myTeamPerms?.edit && myTeamPerms?.create);
  if (!isEdit && !canCreate) return (
    <>
      <Topbar back={`/teams/${teamId}/projects`} backLabel="Projects" />
      <div style={{
        maxWidth: 480, margin: '60px auto 0', textAlign: 'center',
        color: 'var(--text-3)', fontWeight: 800, background: 'var(--card)',
        border: '1px dashed var(--border-2)', borderRadius: 18, padding: 40,
      }}>
        You need both Edit and Create permission on this team to create a project.
      </div>
    </>
  );

  const inp = {
    width: '100%', padding: '12px 14px',
    border: '1.5px solid var(--border)', borderRadius: 12,
    fontSize: 14, fontWeight: 700, background: 'var(--card)',
    marginBottom: 16, outline: 'none', transition: 'border-color .15s',
  };

  return (
    <>
      <Topbar back={`/teams/${teamId}/projects`} backLabel="Projects" />

      <div style={{ maxWidth: 640, margin: '30px auto 0' }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.6px', marginBottom: 4 }}>
          {isEdit ? 'Edit project' : 'Create project'}
        </div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
          {isEdit
            ? <>Update details and add or remove members of the <b>{team?.name || '…'}</b> team.</>
            : <>Set up a project under the <b>{team?.name || '…'}</b> team and choose who works on it.</>}
        </div>

        <div style={{
          background: 'var(--card)', border: '1px solid var(--border-2)',
          borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: 24,
        }}>
          {/* Title */}
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Project title
          </label>
          <input
            value={form.title}
            onChange={e => { set({ title: e.target.value }); setError(''); }}
            placeholder="e.g. Mobile App v3"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {/* Deadline */}
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Deadline
          </label>
          <input
            type="date"
            value={form.deadline}
            onChange={e => { set({ deadline: e.target.value }); setError(''); }}
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {/* Description */}
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Description
          </label>
          <textarea
            value={form.description}
            onChange={e => set({ description: e.target.value })}
            placeholder="What is this project about?"
            style={{ ...inp, minHeight: 78, resize: 'vertical' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {/* Members */}
          <div style={{ fontWeight: 900, fontSize: 15, margin: '8px 0 4px' }}>Project members</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
            Select people and override their permissions for this project — <b>V</b>iew · <b>E</b>dit · <b>C</b>reate · <b>D</b>elete
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {roster.map(m => {
              const pk = picks[m.id] || {};
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  background: pk.selected ? 'var(--inner-bg)' : 'var(--card)',
                  border: `1.5px solid ${pk.selected ? 'var(--accent)' : 'var(--border-2)'}`,
                  borderRadius: 13, padding: '11px 13px', transition: 'all .15s',
                }}>
                  <span onClick={() => toggleSel(m.id)} style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    border: `2px solid ${pk.selected ? 'var(--accent)' : 'var(--checkbox-border)'}`,
                    background: pk.selected ? 'var(--accent)' : 'var(--card)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, cursor: 'pointer',
                  }}>{pk.selected ? '✓' : ''}</span>

                  <span style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: m.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, flexShrink: 0,
                  }}>{m.initials}</span>

                  <span style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>{m.displayName}</span>

                  {pk.selected && (
                    <span style={{ display: 'flex', gap: 6 }}>
                      {[['V','view'],['E','edit'],['C','create'],['D','delete']].map(([lbl, key]) => (
                        <PermPill
                          key={key} label={lbl}
                          active={pk[key]} color={PERM_COLORS[key]}
                          onClick={() => togglePerm(m.id, key)}
                        />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}

            {roster.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, padding: '12px 4px' }}>
                This team has no members yet.
              </div>
            )}
          </div>

          {error && <div style={{ color: '#D9614B', fontWeight: 800, fontSize: 13, marginTop: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={() => navigate(`/teams/${teamId}/projects`)} style={{
              flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
              borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{
              flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 18px rgba(224,122,95,.32)',
              opacity: saving ? .7 : 1,
            }}>{saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create project')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
