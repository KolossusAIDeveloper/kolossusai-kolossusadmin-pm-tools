const assert = require('assert');
const path = require('path');
const fs = require('fs');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

test('server.js exists and uses express', () => {
  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js must exist');
  const content = fs.readFileSync(serverPath, 'utf8');
  assert.ok(content.includes('express'), 'server.js must use express');
  assert.ok(content.includes('3000'), 'server.js must expose port 3000');
});

test('package.json has required dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies && pkg.dependencies.express, 'express dependency must be present');
  assert.ok(pkg.dependencies['http-proxy-middleware'], 'http-proxy-middleware must be present');
});

test('Dockerfile exists and is valid', () => {
  const dockerPath = path.join(__dirname, '..', 'Dockerfile');
  assert.ok(fs.existsSync(dockerPath), 'Dockerfile must exist');
  const content = fs.readFileSync(dockerPath, 'utf8');
  assert.ok(content.includes('EXPOSE 3000'), 'Dockerfile must expose port 3000');
  assert.ok(content.includes('server.js'), 'Dockerfile must run server.js');
});
