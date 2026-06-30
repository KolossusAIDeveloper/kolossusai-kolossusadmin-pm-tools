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
      setError(
        err.status === 401
          ? 'Invalid token — please check and try again.'
          : `Connection error: ${err.message}`
      );
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="token-gate">
      <div className="token-gate-card">
        {/* Logo / Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            PM
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>PM Tools</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Project Management Workspace</div>
          </div>
        </div>

        <div className="token-gate-title">Connect your account</div>
        <div className="token-gate-subtitle">
          Paste your Ocius PM API token below. It stays in your browser session only and is never
          shared with any third party.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">API Token</label>
            <input
              className="input"
              type="password"
              placeholder="Paste your token here..."
              value={token}
              onChange={e => setInputToken(e.target.value)}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="error-msg" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !token.trim()}
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Verifying...
              </span>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            padding: '12px 14px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your token is stored only in this browser session and clears automatically when you
            close the tab.
          </div>
        </div>
      </div>
    </div>
  );
}
