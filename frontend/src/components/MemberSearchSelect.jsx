import { useState } from 'react';

// A single-select, search-only member picker: nothing shows until you type,
// then only matches — never the full roster.
export default function MemberSearchSelect({ members, value, onChange, placeholder = 'Search members…' }) {
  const [query, setQuery] = useState('');
  const selected = members.find(m => m.id === value);
  const matches = query.trim()
    ? members.filter(m => m.displayName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  if (selected) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        border: '1.5px solid var(--border)', borderRadius: 12,
        padding: '8px 10px', background: 'var(--card)',
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          background: selected.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 10,
        }}>{selected.initials}</span>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 13 }}>{selected.displayName}</span>
        <button type="button" onClick={() => onChange(null)} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', fontWeight: 900, fontSize: 13, padding: 0,
        }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px',
          border: '1.5px solid var(--border)', borderRadius: 12,
          fontSize: 13, fontWeight: 700, background: 'var(--card)', outline: 'none',
          transition: 'border-color .15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--card)', border: '1.5px solid var(--border)',
          borderRadius: 12, boxShadow: '0 12px 30px rgba(44,39,34,.18)',
          zIndex: 20, padding: 6, maxHeight: 190, overflowY: 'auto',
        }}>
          {matches.map(m => (
            <div
              key={m.id}
              onMouseDown={e => { e.preventDefault(); onChange(m.id); setQuery(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 8px', borderRadius: 9, cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--inner-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: m.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 10,
              }}>{m.initials}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{m.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
