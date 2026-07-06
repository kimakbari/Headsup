// ── Status metadata ───────────────────────────────────────────────────────────
export const STATUSES = [
  { key: 'todo',      label: 'To Do',               color: '#A99E90', bg: '#F7F1E8' },
  { key: 'doing',     label: 'Doing',               color: '#5FA8A0', bg: '#EDF4F2' },
  { key: 'done',      label: 'Done',                color: '#7FA87B', bg: '#EFF4ED' },
  { key: 'pending',   label: 'Pending',             color: '#C98A2B', bg: '#FBF4E6' },
  { key: 'approval',  label: 'Waiting for Approval',color: '#9B86C4', bg: '#F2EEF8' },
  { key: 'cancelled', label: 'Cancelled',           color: '#B9AD9C', bg: '#F5F1EA' },
];

export function statusMeta(key) {
  return STATUSES.find(s => s.key === key) || STATUSES[0];
}

// ── Priority metadata ─────────────────────────────────────────────────────────
export function prioMeta(p) {
  return {
    Low:    { color: '#5E8A57', bg: '#EEF4EC' },
    Medium: { color: '#B0791F', bg: '#FBF1DD' },
    High:   { color: '#C8472F', bg: '#FBE7E1' },
  }[p] || { color: '#6B6258', bg: '#F4ECE1' };
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function deadlineColor(iso, status) {
  if (!iso) return '#A99E90';
  if (status === 'done' || status === 'cancelled') return '#A99E90';
  const days = Math.ceil((new Date(iso + 'T00:00:00') - new Date()) / 86400000);
  if (days < 0)  return '#D9614B';
  if (days <= 7) return '#C98A2B';
  return '#8A8073';
}

export function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso + 'T00:00:00') - new Date()) / 86400000);
}

// ── Team badge helpers ────────────────────────────────────────────────────────
export function teamInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || '')).toUpperCase();
}

// ── SVG ring helpers ──────────────────────────────────────────────────────────
export function ringParams(pct, r) {
  const c   = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return { circumference: c.toFixed(1), offset: off.toFixed(1) };
}

// ── Time ago ─────────────────────────────────────────────────────────────────
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
