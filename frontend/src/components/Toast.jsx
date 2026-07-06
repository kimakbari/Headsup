import { useState, useCallback, useEffect, useRef } from 'react';

let _showToast = null;

export function useToast() {
  const show = useCallback((msg) => {
    if (_showToast) _showToast(msg);
  }, []);
  return show;
}

export function Toast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    _showToast = (m) => {
      setMsg(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 2400);
    };
    return () => { _showToast = null; };
  }, []);

  if (!msg) return null;

  return (
    <div className="anim-toast" style={{
      position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
      background: '#2C2722', color: '#fff',
      fontWeight: 800, fontSize: 14,
      padding: '13px 22px', borderRadius: 14,
      boxShadow: '0 14px 36px rgba(44,39,34,.34)',
      zIndex: 9999, whiteSpace: 'nowrap',
    }}>
      {msg}
    </div>
  );
}
