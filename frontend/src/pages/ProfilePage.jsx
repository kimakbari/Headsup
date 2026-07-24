import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import TeamBadge from '../components/TeamBadge';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const toast     = useToast();
  const { user, setUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams]     = useState([]);
  const [form, setForm] = useState({
    username: '', currentPassword: '', newPassword: '', error: '', saving: false,
  });
  const set = p => setForm(f => ({ ...f, ...p }));

  useEffect(() => {
    api.get('/members/me').then(r => {
      set({ username: r.data.username });
      setTeams(r.data.teams || []);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.username.trim()) { set({ error: 'Username is required.' }); return; }
    if (form.newPassword.trim() && !form.currentPassword.trim()) {
      set({ error: 'Enter your current password to set a new one.' }); return;
    }

    set({ saving: true, error: '' });
    try {
      await api.put('/members/me', {
        username:        form.username.trim(),
        currentPassword: form.currentPassword.trim() || undefined,
        newPassword:     form.newPassword.trim() || undefined,
      });
      setUser(u => ({ ...u, username: form.username.trim() }));
      set({ currentPassword: '', newPassword: '' });
      toast(form.newPassword.trim() ? 'Profile updated · password changed' : 'Profile updated');
    } catch (err) {
      set({ error: err.response?.data?.error || 'Something went wrong.' });
    } finally {
      set({ saving: false });
    }
  };

  const inp = {
    width: '100%', padding: '12px 14px',
    border: '1.5px solid var(--border)', borderRadius: 12,
    fontSize: 14, fontWeight: 700, background: 'var(--card)',
    marginBottom: 16, outline: 'none', transition: 'border-color .15s',
  };

  if (loading) return (
    <>
      <Topbar />
      <div style={{ color: 'var(--text-3)', fontWeight: 800, padding: 40 }}>Loading…</div>
    </>
  );

  return (
    <>
      <Topbar />

      <div style={{ maxWidth: 480, margin: '30px auto 0' }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.6px', marginBottom: 4 }}>
          My profile
        </div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
          Update your username or password.
        </div>

        <div style={{
          background: 'var(--card)', border: '1px solid var(--border-2)',
          borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: 24,
        }}>
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 12,
              background: user?.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>{user?.initials}</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{user?.displayName}</div>
              <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 12 }}>
                {user?.isAdmin ? 'Admin' : 'Team member'}
              </div>
            </div>
          </div>

          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Username
          </label>
          <input
            value={form.username}
            onChange={e => set({ username: e.target.value, error: '' })}
            placeholder="e.g. maya"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Current password
          </label>
          <input
            type="password"
            value={form.currentPassword}
            onChange={e => set({ currentPassword: e.target.value, error: '' })}
            placeholder="Required only to set a new password"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            New password (leave blank to keep)
          </label>
          <input
            type="password"
            value={form.newPassword}
            onChange={e => set({ newPassword: e.target.value, error: '' })}
            placeholder="New password"
            style={{ ...inp, marginBottom: 0 }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {form.error && (
            <div style={{ color: '#D9614B', fontWeight: 800, fontSize: 13, marginTop: 12 }}>
              {form.error}
            </div>
          )}

          {/* Teams — read only */}
          <div style={{ fontWeight: 900, fontSize: 15, margin: '24px 0 10px' }}>Teams</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teams.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 11,
                background: 'var(--inner-bg)', border: '1px solid var(--inner-border)',
                borderRadius: 12, padding: '9px 12px',
              }}>
                <TeamBadge name={t.name} color={t.color} icon={t.icon} size={30} radius={9} fontSize={15} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</span>
              </div>
            ))}
            {teams.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, padding: '6px 2px' }}>
                You're not on any teams yet.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={() => navigate(-1)} style={{
              flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
              borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}>Back</button>
            <button onClick={save} disabled={form.saving} style={{
              flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 14,
              cursor: form.saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 18px rgba(224,122,95,.32)',
              opacity: form.saving ? .7 : 1,
            }}>
              {form.saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
