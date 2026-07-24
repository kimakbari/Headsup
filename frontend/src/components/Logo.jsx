// The "Heads up" mark — an H whose right leg becomes an upward arrow.
// Icon colors stay fixed across themes (white glyph on the accent square);
// only the "Heads" text swaps between dark (light theme) and cream (dark theme)
// via var(--text), while "up" always stays in the accent color.
export default function Logo({ iconSize = 34, fontSize = 19, shadow = false, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: iconSize * 0.3 }}>
      <div style={{
        width: iconSize, height: iconSize, borderRadius: iconSize * 0.32, flexShrink: 0,
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: shadow ? '0 6px 18px rgba(224,122,95,.4)' : 'none',
      }}>
        <svg width={iconSize * 0.56} height={iconSize * 0.56} viewBox="0 0 24 24" fill="none">
          <path d="M6 5v14M6 12h8M15 19V9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 8l4-4 4 4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      {showText && (
        <span style={{
          fontWeight: 900, fontSize, letterSpacing: '-.5px',
          display: 'flex', alignItems: 'baseline', gap: fontSize * 0.28,
        }}>
          <span style={{ color: 'var(--text)' }}>Heads</span>
          <span style={{
            color: 'var(--accent)', display: 'inline-block',
            transform: 'rotate(-8deg)', fontSize: fontSize * 1.15,
          }}>up</span>
        </span>
      )}
    </div>
  );
}
