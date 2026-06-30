import React, { useState } from 'react';
import { pm, setToken, probeApi } from '../api/pmClient';
import { useAuth } from '../contexts/AuthContext';

export default function TokenGate() {
  const { login } = useAuth();
  const [token, setInputToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError('');
    setProbeResult(null);

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
      } else if (err.status === 403) {
        setError('Access denied (403). Your API key may lack required permissions, or the token format is wrong. OpenProject requires an API key (not a login password). Generate one under My Account → Access Tokens in Ocius.');
      } else if (err.status === 404) {
        setError('API endpoint not found (404). The Ocius API path may differ — try Diagnostics below.');
      } else {
        setError(`Connection error: ${err.message}. Check your network and that the Ocius API is reachable.`);
      }
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleProbe() {
    if (!token.trim()) return;
    setProbing(true);
    setProbeResult(null);
    try {
      const result = await probeApi(token.trim());
      setProbeResult(result);
    } catch {
      setProbeResult({ found: false, error: 'Could not reach the diagnostic endpoint.' });
    } finally {
      setProbing(false);
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

        {/* Diagnostics section — shown when there's an error and a token is entered */}
        {error && token.trim() && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={handleProbe}
              disabled={probing}
              style={{ fontSize: 12, padding: '6px 12px', color: 'var(--text-muted)' }}
            >
              {probing ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Scanning API…</> : '🔍 Run Diagnostics'}
            </button>

            {probeResult && (
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6 }}>
                {probeResult.found ? (
                  <div style={{ color: 'var(--success, #4ade80)' }}>
                    ✓ Working endpoint found: <code>{probeResult.endpoint}</code> with <code>{probeResult.authFormat}</code> auth.
                    <br />Share this with your administrator to update the app configuration.
                  </div>
                ) : (
                  <div>
                    {probeResult.pathHits && probeResult.pathHits.length > 0 ? (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ color: '#facc15', fontWeight: 600, marginBottom: 4 }}>
                          ⚡ Found {probeResult.pathHits.length} real API path(s) — token auth was rejected:
                        </div>
                        {probeResult.pathHits.map((r, i) => (
                          <div key={i} style={{ fontFamily: 'monospace', fontSize: 11, color: '#facc15' }}>
                            → {r.endpoint} [{r.authFormat}] → HTTP {r.status}
                            {r.bodySnippet && <div style={{ color: 'var(--text-muted)', marginLeft: 10 }}>{r.bodySnippet}</div>}
                          </div>
                        ))}
                        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                          The API paths above exist. The token may need a different format — contact your Ocius administrator with the paths above.
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>
                        No API paths found — every path returned 404. The API may be at a different base URL.
                      </div>
                    )}
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>View all {probeResult.results?.length ?? 0} results</summary>
                      <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11, maxHeight: 200, overflowY: 'auto' }}>
                        {probeResult.results?.map((r, i) => (
                          <div key={i} style={{ color: r.ok ? '#4ade80' : r.status && r.status !== 404 ? '#facc15' : 'var(--text-muted)' }}>
                            {r.ok ? '✓' : r.status && r.status !== 404 ? '!' : '✗'} {r.endpoint} [{r.authFormat}] → {r.status || 'err'}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Your token is never stored on our servers. It clears when you close the tab.
        </p>
      </div>
    </div>
  );
}
