import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { useToast } from '../components/Toast';
import api from '../api';

const PERM_COLORS = { view: '#5FA8A0', edit: '#E2B25E', create: '#9B86C4', delete: '#D9614B' };
const ICONS = ['👥','🚀','💡','🎯','🛠️','📊','🌱','🔥','⭐','🎨','📦','🧭'];

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

export default function TeamForm() {
  const { teamId } = useParams();
  const isEdit      = !!teamId;
  const navigate     = useNavigate();
  const toast        = useToast();

  const [name, setName]       = useState('');
  const [icon, setIcon]       = useState(ICONS[0]);
  const [members, setMembers] = useState([]);  // all available non-admin members
  const [picks, setPicks]     = useState({});  // { memberId: { selected, view, edit, create, delete } }
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    Promise.all([
      api.get('/members'),
      isEdit ? api.get('/teams') : Promise.resolve(null),
    ]).then(([membersRes, teamsRes]) => {
      setMembers(membersRes.data);
      const team = teamsRes?.data.find(t => t.id === teamId);

      if (isEdit && team) {
        setName(team.name);
        setIcon(team.icon);
      }

      const p = {};
      membersRes.data.forEach(m => {
        const existing = team?.members.find(tm => tm.id === m.id);
        p[m.id] = existing
          ? { selected: true, ...existing.perms }
          : { selected: false, view: true, edit: false, create: false, delete: false };
      });
      setPicks(p);
    }).finally(() => setLoading(false));
  }, [teamId]);

  const toggleSel = (id) => {
    setPicks(p => ({ ...p, [id]: { ...p[id], selected: !p[id].selected } }));
  };

  const togglePerm = (id, key) => {
    setPicks(p => {
      const cur = { ...p[id] };
      cur[key] = !cur[key];
      // view is required for all others
      if (key === 'view' && !cur.view) { cur.edit = false; cur.create = false; cur.delete = false; }
      if (key !== 'view' && cur[key])  { cur.view = true; }
      return { ...p, [id]: cur };
    });
  };

  const save = async () => {
    if (!name.trim()) { setError('Give the team a name.'); return; }
    const chosen = members.filter(m => picks[m.id]?.selected);
    if (!chosen.length) { setError('Add at least one member.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        icon,
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
        await api.put(`/teams/${teamId}`, payload);
        toast('Team updated');
      } else {
        await api.post('/teams', payload);
        toast('Team created');
      }
      navigate('/teams');
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

  return (
    <>
      <Topbar back="/teams" backLabel="Teams" />

      <div style={{ maxWidth: 640, margin: '30px auto 0' }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.6px', marginBottom: 4 }}>
          {isEdit ? 'Edit team' : 'Add a team'}
        </div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
          {isEdit ? 'Add or remove members and update their permissions.' : 'Group members and set their default permissions.'}
        </div>

        <div style={{
          background: 'var(--card)', border: '1px solid var(--border-2)',
          borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: 24,
        }}>
          {/* Team name */}
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Team name
          </label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="e.g. Growth"
            style={{
              width: '100%', padding: '12px 14px',
              border: '1.5px solid var(--border)', borderRadius: 12,
              fontSize: 14, fontWeight: 700, background: 'var(--card)',
              marginBottom: 20, outline: 'none', transition: 'border-color .15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {/* Icon */}
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Team icon
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {ICONS.map(ic => (
              <button key={ic} type="button" onClick={() => setIcon(ic)} style={{
                width: 42, height: 42, borderRadius: 12, fontSize: 19, cursor: 'pointer',
                border: `1.5px solid ${icon === ic ? 'var(--accent)' : 'var(--border-2)'}`,
                background: icon === ic ? 'var(--inner-bg)' : 'var(--card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}>{ic}</button>
            ))}
          </div>

          {/* Members */}
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>Team members</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
            Select people, then set their permissions — <b>V</b>iew · <b>E</b>dit · <b>C</b>reate · <b>D</b>elete
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {members.map(m => {
              const pk = picks[m.id] || {};
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  background: pk.selected ? 'var(--inner-bg)' : 'var(--card)',
                  border: `1.5px solid ${pk.selected ? 'var(--accent)' : 'var(--border-2)'}`,
                  borderRadius: 13, padding: '11px 13px', transition: 'all .15s',
                }}>
                  {/* Checkbox */}
                  <span onClick={() => toggleSel(m.id)} style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    border: `2px solid ${pk.selected ? 'var(--accent)' : 'var(--checkbox-border)'}`,
                    background: pk.selected ? 'var(--accent)' : 'var(--card)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, cursor: 'pointer',
                  }}>{pk.selected ? '✓' : ''}</span>

                  {/* Avatar */}
                  <span style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: m.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, flexShrink: 0,
                  }}>{m.initials}</span>

                  <span style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>{m.displayName}</span>

                  {/* Permission pills — only show when selected */}
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

            {members.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, padding: '12px 4px' }}>
                No members yet — create some from the Members page first.
              </div>
            )}
          </div>

          {error && <div style={{ color: '#D9614B', fontWeight: 800, fontSize: 13, marginTop: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={() => navigate('/teams')} style={{
              flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
              borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{
              flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 18px rgba(224,122,95,.32)',
              opacity: saving ? .7 : 1,
            }}>{saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create team')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
