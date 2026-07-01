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

// Diagnostic probe — tests multiple API endpoints and auth formats server-side
// GET /api/probe?token=xxx
app.get('/api/probe', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'token query param required' });

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

  // OpenProject v3 paths first, then generic discovery
  const endpoints = [
    // OpenProject API v3
    '/api/v3/users/me', '/api/v3/projects', '/api/v3/statuses',
    '/api/v3/work_packages', '/api/v3/priorities', '/api/v3/types',
    // Generic discovery
    '/', '/api', '/api/v1', '/api/v2',
    '/health', '/ping', '/status',
    '/me', '/users/me', '/user', '/profile',
    '/projects', '/workspaces', '/tasks', '/issues', '/work_packages',
    '/api/me', '/api/users/me', '/api/v1/me', '/api/v1/users/me',
    '/api/projects', '/api/workspaces', '/api/tasks', '/api/issues',
    '/v1/me', '/v1/projects', '/v2/me', '/v2/projects',
    '/rest/api/2/myself', '/rest/api/3/myself',
  ];

  // Auth formats — OpenProject Basic (apikey:token) listed FIRST
  const authFormats = [
    { label: 'Authorization: Basic (apikey:***)', getHeader: (t) => ({ Authorization: `Basic ${Buffer.from(`apikey:${t}`).toString('base64')}` }) },
    { label: 'Authorization: Bearer ***', getHeader: (t) => ({ Authorization: `Bearer ${t}` }) },
    { label: 'Authorization: Token ***', getHeader: (t) => ({ Authorization: `Token ${t}` }) },
    { label: 'Authorization: Api-Key ***', getHeader: (t) => ({ Authorization: `Api-Key ${t}` }) },
    { label: 'X-Auth-Token: ***', getHeader: (t) => ({ 'X-Auth-Token': t }) },
    { label: 'X-Api-Key: ***', getHeader: (t) => ({ 'X-Api-Key': t }) },
    { label: 'api-key: ***', getHeader: (t) => ({ 'api-key': t }) },
  ];

  const results = [];
  const pathHits = [];

  for (const endpoint of endpoints) {
    const noAuthResult = await probeRaw(endpoint);

    if (noAuthResult.status !== 404 && noAuthResult.status !== 0) {
      for (const fmt of authFormats) {
        const result = await probeRaw(endpoint, fmt.getHeader(token));
        const entry = { endpoint, authFormat: fmt.label, status: result.status, ok: result.ok };
        if (result.body) entry.bodySnippet = JSON.stringify(result.body).slice(0, 300);
        results.push(entry);
        if (result.ok) {
          return res.json({ found: true, endpoint, authFormat: fmt.label, body: result.body, results });
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

// Direct HTTPS forwarder for mutating requests (POST/PATCH/PUT).
// express.json() drains the body stream before the proxy runs, so the
// http-proxy-middleware body-rewrite approach can hang indefinitely.
// This handler makes a fresh HTTPS request with the already-parsed body.
function forwardMutating(req, res) {
  const auth = req.headers['authorization'] || '';
  const bodyData = req.body && Object.keys(req.body).length > 0
    ? JSON.stringify(req.body)
    : '';

  const pmUrl = new URL(PM_API_BASE + req.url);
  const options = {
    hostname: pmUrl.hostname,
    path: pmUrl.pathname + pmUrl.search,
    method: req.method,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/hal+json, application/json',
    },
    timeout: 30000,
  };
  if (bodyData) options.headers['Content-Length'] = Buffer.byteLength(bodyData);

  const proxyReq = https.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    const ct = proxyRes.headers['content-type'];
    if (ct) res.setHeader('Content-Type', ct);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).json({ error: 'Gateway timeout' });
  });
  proxyReq.on('error', (err) => {
    if (!res.headersSent) res.status(502).json({ error: 'Proxy error', message: err.message });
  });

  if (bodyData) proxyReq.write(bodyData);
  proxyReq.end();
}

// Intercept POST/PATCH/PUT before the GET proxy so body is forwarded correctly.
app.use('/proxy', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    return forwardMutating(req, res);
  }
  next();
});

// Proxy all GET/DELETE /proxy/* requests to the PM API
app.use('/proxy', createProxyMiddleware({
  target: PM_API_BASE,
  changeOrigin: true,
  pathRewrite: { '^/proxy': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      const auth = req.headers['authorization'];
      if (auth) proxyReq.setHeader('Authorization', auth);
    },
    error: (err, req, res) => {
      res.status(502).json({ error: 'Proxy error', message: err.message });
    }
  }
}));

// Serve static React build
app.use(express.static(path.join(__dirname, 'client', 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PM Tools server running on port ${PORT}`);
});
