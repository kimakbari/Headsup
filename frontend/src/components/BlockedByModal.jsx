import { useState } from 'react';
import { BLOCKER_TEAMS } from '../utils';

export default function BlockedByModal({ onConfirm, onCancel }) {
  const [team, setTeam] = useState('');

  return (
    <div
      onClick={onCancel}
      className="anim-fade"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(44,39,34,.4)', backdropFilter: 'blur(3px)',
        zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{
        width: '100%', maxWidth: 380, background: 'var(--card)',
        borderRadius: 20, boxShadow: '0 30px 70px rgba(44,39,34,.3)', padding: 24,
      }}>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.4px', marginBottom: 6 }}>
          Which team is this blocked on?
        </div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          This task is moving to Pending — pick who it's waiting on.
        </div>

        <select
          value={team}
          onChange={e => setTeam(e.target.value)}
          style={{
            width: '100%', padding: '12px 14px',
            border: '1.5px solid var(--border)', borderRadius: 12,
            fontSize: 14, fontWeight: 700, background: 'var(--card)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="" disabled>Select a team…</option>
          {BLOCKER_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={() => team && onConfirm(team)} disabled={!team} style={{
            flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 14,
            cursor: team ? 'pointer' : 'not-allowed', opacity: team ? 1 : .6,
            boxShadow: '0 6px 18px rgba(224,122,95,.32)',
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
