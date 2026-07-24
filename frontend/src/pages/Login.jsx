import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await login(username, password);
      navigate(user.isAdmin ? '/home' : '/my-tasks', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '13px 15px',
    border: '1.5px solid var(--border)', borderRadius: 13,
    fontSize: 15, fontWeight: 700, background: 'var(--card)',
    marginBottom: 16, outline: 'none',
    transition: 'border-color .15s',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
    }}>
      {/* Left — branding */}
      <div style={{
        background: 'var(--login-gradient)',
        padding: '56px 60px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ zIndex: 1 }}>
          <Logo iconSize={42} fontSize={24} shadow />
        </div>

        {/* Headline */}
        <div style={{ zIndex: 1, maxWidth: 420 }}>
          <div style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-1px', marginBottom: 18 }}>
            Every team, every task — in one warm little place.
          </div>
          <p style={{ fontSize: 17, color: 'var(--text-2)', fontWeight: 600, lineHeight: 1.55, margin: 0 }}>
            Track projects across teams, watch progress fill up, and keep work moving.
            Built for the way your org actually works.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['6 status columns','Per-project permissions','Live progress rings'].map(f => (
            <div key={f} style={{
              background: 'var(--card)', borderRadius: 14, padding: '12px 16px',
              boxShadow: '0 4px 16px rgba(44,39,34,.06)',
              fontWeight: 800, fontSize: 13, color: 'var(--text-2)',
            }}>{f}</div>
          ))}
        </div>

        {/* Decorative circle */}
        <div style={{
          position: 'absolute', right: -90, bottom: -90,
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(224,122,95,.18),transparent 70%)',
        }} />
      </div>

      {/* Right — form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.5px', marginBottom: 4 }}>
            Welcome back
          </div>
          <div style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginBottom: 28 }}>
            Sign in to your workspace
          </div>

          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Username
          </label>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="e.g. admin"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, marginBottom: 7, color: 'var(--text-2)' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="••••••"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {error && (
            <div style={{ color: '#D9614B', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{
            width: '100%', marginTop: 10,
            background: 'var(--accent)', color: '#fff',
            border: 'none', padding: 14, borderRadius: 13,
            fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 18px rgba(224,122,95,.35)',
            opacity: loading ? .7 : 1,
            transition: 'filter .15s',
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.filter = 'brightness(1.05)')}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
