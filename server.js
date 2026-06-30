const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PM_API_BASE = 'https://pm.ociustechnologies.com';

app.use(cors());
app.use(express.json());

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
