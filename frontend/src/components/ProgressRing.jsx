import { ringParams } from '../utils';

export default function ProgressRing({ pct = 0, size = 108, r = 46, stroke = 11, color = 'var(--accent)', label }) {
  const { circumference, offset } = ringParams(pct, r);
  const viewSize = (r + stroke) * 2 + 4;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={viewSize / 2} cy={viewSize / 2} r={r}
          fill="none" stroke="var(--inner-border)" strokeWidth={stroke}
        />
        <circle
          cx={viewSize / 2} cy={viewSize / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: size * 0.22, letterSpacing: '-1px',
      }}>
        {label ?? `${pct}%`}
      </div>
    </div>
  );
}
