import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { useToast } from '../components/Toast';
import api from '../api';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast    = useToast();

  const load = () =>
    api.get('/members').then(r => setMembers(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const deleteMember = async (id, name) => {
    if (!confirm(`Remove "${name}" from the workspace?`)) return;
    await api.delete(`/members/${id}`);
    toast('Member removed');
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
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.8px' }}>Members</div>
          <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 15, marginTop: 3 }}>
            People in your workspace
          </div>
        </div>
        <button onClick={() => navigate('/members/new')} style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          padding: '12px 18px', borderRadius: 13,
          fontWeight: 900, fontSize: 14, cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(224,122,95,.32)',
        }}>＋ Create Member</button>
      </div>

      <div style={{
        background: 'var(--card)', border: '1px solid var(--border-2)',
        borderRadius: 18, boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      }}>
        {members.map((m, i) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 13,
            padding: '15px 20px',
            borderBottom: i < members.length - 1 ? '1px solid var(--divider)' : 'none',
          }}>
            <span style={{
              width: 38, height: 38, borderRadius: 11,
              background: m.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, flexShrink: 0,
            }}>{m.initials}</span>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{m.displayName}</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-3)' }}>
                @{m.username}
              </div>
            </div>

            <button onClick={() => navigate(`/members/${m.id}/edit`)} style={{
              background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
              borderRadius: 10, padding: '8px 14px',
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              transition: 'border-color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >Edit</button>

            <button onClick={() => deleteMember(m.id, m.displayName)} style={{
              background: 'var(--card)', border: '1.5px solid var(--border)',
              borderRadius: 10, padding: '8px 14px',
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              color: '#D9614B', transition: 'border-color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#D9614B'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >Delete</button>
          </div>
        ))}

        {members.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontWeight: 800 }}>
            No members yet — create one to get started. 🌿
          </div>
        )}
      </div>
    </>
  );
}
