import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { useToast } from '../components/Toast';
import api from '../api';

export default function MemberForm() {
  const { id }   = useParams();      // present when editing
  const isEdit   = !!id;
  const navigate = useNavigate();
  const toast    = useToast();

  const [form, setForm] = useState({
    displayName: '', username: '', password: '', error: '', saving: false,
  });
  const set = p => setForm(f => ({ ...f, ...p }));

  useEffect(() => {
    if (!isEdit) return;
    api.get('/members').then(r => {
      const m = r.data.find(x => x.id === id);
      if (m) set({ displayName: m.displayName, username: m.username });
    });
  }, [id]);

  const save = async () => {
    if (!form.displayName.trim() || !form.username.trim()) {
      set({ error: 'Name and username are required.' }); return;
    }
    if (!isEdit && !form.password.trim()) {
      set({ error: 'Set an initial password.' }); return;
    }
    set({ saving: true, error: '' });
    try {
      if (isEdit) {
        await api.put(`/members/${id}`, {
          displayName: form.displayName.trim(),
          username:    form.username.trim(),
          password:    form.password.trim() || undefined,
        });
        toast(form.password.trim() ? 'Member updated · password reset' : 'Member updated');
      } else {
        await api.post('/members', {
          displayName: form.displayName.trim(),
          username:    form.username.trim(),
          password:    form.password.trim(),
        });
        toast('Member created');
      }
      navigate('/members');
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

  return (
    <>
      <Topbar back="/members" backLabel="Members" />

      <div style={{ maxWidth: 480, margin: '30px auto 0' }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.6px', marginBottom: 4 }}>
          {isEdit ? 'Edit member' : 'Create member'}
        </div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
          {isEdit
            ? 'Update their details or reset their password.'
            : 'Add someone to your workspace.'}
        </div>

        <div style={{
          background: 'var(--card)', border: '1px solid var(--border-2)',
          borderRadius: 18, boxShadow: 'var(--shadow-md)', padding: 24,
        }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Display name
          </label>
          <input
            value={form.displayName}
            onChange={e => set({ displayName: e.target.value, error: '' })}
            placeholder="e.g. Maya Chen"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

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
            {isEdit ? 'Reset password (leave blank to keep)' : 'Initial password'}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => set({ password: e.target.value, error: '' })}
            placeholder={isEdit ? 'New password' : 'Set a password'}
            style={{ ...inp, marginBottom: 0 }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {form.error && (
            <div style={{ color: '#D9614B', fontWeight: 800, fontSize: 13, marginTop: 12 }}>
              {form.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={() => navigate('/members')} style={{
              flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
              borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={save} disabled={form.saving} style={{
              flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 14,
              cursor: form.saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 18px rgba(224,122,95,.32)',
              opacity: form.saving ? .7 : 1,
            }}>
              {form.saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create member'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
