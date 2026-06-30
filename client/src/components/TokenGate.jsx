import React, { useState } from 'react';
import { pm, setToken } from '../api/pmClient';
import { useAuth } from '../contexts/AuthContext';

export default function TokenGate() {
  const { login } = useAuth();
  const [token, setInputToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError('');

    try {
      setToken(token.trim());
      const { ok, user } = await pm.verifyToken();
      if (ok) {
        login(token.trim(), user);
      } else {
        setError('Invalid token — please check and try again.');
        setToken(null);
      }
    } catch (err) {
      if (err.status === 401) {
        setError('Invalid token — please check and try again.');
      } else {
        setError(`Connection error: ${err.message}. Check network / API reachability.`);
      }
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="token-gate">
      <div className="token-gate-card">
        <div className="token-gate-logo">
          <div className="token-gate-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>PM Tools</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ocius Sync</div>
          </div>
        </div>

        <h2 className="token-gate-title">Connect your account</h2>
        <p className="token-gate-subtitle">
          Paste your Ocius API token below. It stays in your browser session only.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">API Token</label>
            <input
              className="input"
              type="password"
              placeholder="Paste your token here…"
              value={token}
              onChange={e => setInputToken(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="error-msg" style={{ marginBottom: 16 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !token.trim()}
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          >
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</> : 'Connect'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Your token is never stored on our servers. It clears when you close the tab.
        </p>
      </div>
    </div>
  );
}
