import { teamInitials } from '../utils';

export default function TeamBadge({ name, color, icon, size = 56, radius = 15, fontSize }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: color || '#E07A5F', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: fontSize || size * 0.5,
    }}>
      {icon || teamInitials(name)}
    </div>
  );
}
