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
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
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

  const endpoints = [
    '/api/me', '/api/users/me', '/api/v1/me', '/api/v1/users/me',
    '/api/auth/me', '/api/profile', '/api/account', '/api/user',
    '/api/projects',
  ];
  const authFormats = ['Bearer', 'Token', 'Api-Key'];

  const results = [];

  for (const endpoint of endpoints) {
    for (const prefix of authFormats) {
      const result = await probeEndpoint(endpoint, `${prefix} ${token}`);
      results.push({ endpoint, authFormat: prefix, status: result.status, ok: result.ok });
      if (result.ok) {
        // Found a working combo — include and stop
        return res.json({ found: true, endpoint, authFormat: prefix, results });
      }
    }
  }

  res.json({ found: false, results });
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
