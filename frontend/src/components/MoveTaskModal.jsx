import { useState } from 'react';

export default function MoveTaskModal({ projects, moving, onConfirm, onCancel }) {
  const [projectId, setProjectId] = useState('');

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
          Move task to…
        </div>
        <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          Choose another project on this team. Owners and subtask assignees will be cleared, since they may not apply there.
        </div>

        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          style={{
            width: '100%', padding: '12px 14px',
            border: '1.5px solid var(--border)', borderRadius: 12,
            fontSize: 14, fontWeight: 700, background: 'var(--card)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="" disabled>Select a project…</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: 'var(--inner-bg)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={() => projectId && onConfirm(projectId)} disabled={!projectId || moving} style={{
            flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 14,
            cursor: (!projectId || moving) ? 'not-allowed' : 'pointer', opacity: (!projectId || moving) ? .6 : 1,
            boxShadow: '0 6px 18px rgba(224,122,95,.32)',
          }}>{moving ? 'Moving…' : 'Move'}</button>
        </div>
      </div>
    </div>
  );
}
