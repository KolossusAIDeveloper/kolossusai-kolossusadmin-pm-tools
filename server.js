const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const PM_API_BASE = 'https://pm.ociustechnologies.com';

app.use(cors());
app.use(express.json());

// Helper: test a single Ocius endpoint from the server side
function probeEndpoint(endpoint, authHeader) {
  return new Promise((resolve) => {
    const url = new URL(PM_API_BASE + endpoint);
    const hdrs = { Accept: 'application/json' };
    if (authHeader) hdrs['Authorization'] = authHeader;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: hdrs,
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, body: json });
      });
    });
    req.on('error', (err) => resolve({ status: 0, ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, error: 'timeout' }); });
    req.end();
  });
}

// Diagnostic probe — tests multiple API endpoints and auth formats server-side
// GET /api/probe?token=xxx
// Returns which endpoint + auth format worked (token value is never logged)
app.get('/api/probe', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'token query param required' });

  // First: check root with no auth to understand the server
  function probeRaw(endpoint, extraHeaders = {}) {
    return new Promise((resolve) => {
      const url = new URL(PM_API_BASE + endpoint);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Accept: 'application/json', ...extraHeaders },
        timeout: 8000,
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, body: json || body.slice(0, 500), headers: res.headers });
        });
      });
      req.on('error', err => resolve({ status: 0, ok: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, error: 'timeout' }); });
      req.end();
    });
  }

  // Try many path patterns: with /api/, without, with /v1/, with /v2/, REST-style, etc.
  const endpoints = [
    // Discovery — root and docs
    '/', '/api', '/api/', '/api/v1', '/api/v2',
    '/docs', '/api-docs', '/swagger', '/swagger.json', '/openapi.json',
    '/api/docs', '/api/swagger', '/health', '/ping', '/status',
    // No /api/ prefix
    '/me', '/users/me', '/user', '/profile', '/account',
    '/projects', '/workspaces', '/tasks', '/boards', '/issues',
    // /api/ prefix
    '/api/me', '/api/users/me', '/api/v1/me', '/api/v1/users/me',
    '/api/auth/me', '/api/profile', '/api/account', '/api/user',
    '/api/projects', '/api/workspaces', '/api/tasks', '/api/issues',
    '/api/current-user', '/api/whoami', '/api/users/current',
    // /v1/ /v2/ prefix (no /api)
    '/v1/me', '/v1/users/me', '/v1/projects', '/v1/workspaces', '/v1/issues',
    '/v2/me', '/v2/projects',
    // Jira-style
    '/rest/api/2/myself', '/rest/api/3/myself', '/rest/api/2/project',
    // Laravel / common PHP
    '/api/user', '/api/auth/user', '/api/auth/check',
  ];

  const authFormats = [
    { prefix: 'Bearer', headerName: 'Authorization' },
    { prefix: 'Token', headerName: 'Authorization' },
    { prefix: 'Api-Key', headerName: 'Authorization' },
    { prefix: '', headerName: 'X-Auth-Token' },
    { prefix: '', headerName: 'X-Api-Key' },
    { prefix: '', headerName: 'api-key' },
  ];

  const results = [];
  const pathHits = [];

  for (const endpoint of endpoints) {
    // First probe with no auth to detect if path exists
    const noAuthResult = await probeRaw(endpoint);

    if (noAuthResult.status !== 404 && noAuthResult.status !== 0) {
      // Path exists! Now try all auth formats
      for (const fmt of authFormats) {
        const authValue = fmt.prefix ? `${fmt.prefix} ${token}` : token;
        const extraHeaders = { [fmt.headerName]: authValue };
        const result = await probeRaw(endpoint, extraHeaders);
        const label = fmt.prefix ? `${fmt.headerName}: ${fmt.prefix} ***` : `${fmt.headerName}: ***`;
        const entry = { endpoint, authFormat: label, status: result.status, ok: result.ok };
        if (result.body) entry.bodySnippet = JSON.stringify(result.body).slice(0, 300);
        results.push(entry);
        if (result.ok) {
          return res.json({ found: true, endpoint, authFormat: label, body: result.body, results });
        }
        entry.pathExists = true;
        pathHits.push(entry);
      }
    } else {
      results.push({ endpoint, authFormat: 'none', status: noAuthResult.status, ok: false });
    }
  }

  res.json({ found: false, pathHits, results });
});

// Proxy all /proxy/* requests to the PM API
app.use('/proxy', createProxyMiddleware({
  target: PM_API_BASE,
  changeOrigin: true,
  pathRewrite: { '^/proxy': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      // Forward the Authorization header if present
      const auth = req.headers['authorization'];
      if (auth) {
        proxyReq.setHeader('Authorization', auth);
      }
    },
    error: (err, req, res) => {
      res.status(502).json({ error: 'Proxy error', message: err.message });
    }
  }
}));

// Serve static React build
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PM Tools server running on port ${PORT}`);
});
