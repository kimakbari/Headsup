import { Outlet } from 'react-router-dom';
import { Toast } from './Toast';

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 22px 80px' }}>
        <Outlet />
      </div>
      <Toast />
    </div>
  );
}
