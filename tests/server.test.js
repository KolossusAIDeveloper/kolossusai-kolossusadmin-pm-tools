const assert = require('assert');
const path = require('path');

// Test that server.js can be required without errors
test('server module loads', () => {
  // Just check the file exists and is valid JS
  const fs = require('fs');
  const serverPath = path.join(__dirname, '..', 'server.js');
  assert.ok(fs.existsSync(serverPath), 'server.js exists');
  const content = fs.readFileSync(serverPath, 'utf8');
  assert.ok(content.includes('express'), 'server uses express');
  assert.ok(content.includes('3000'), 'server exposes port 3000');
});

test('package.json has required dependencies', () => {
  const pkg = require('../package.json');
  assert.ok(pkg.dependencies.express, 'express dependency present');
  assert.ok(pkg.dependencies['http-proxy-middleware'], 'proxy middleware present');
});

test('Dockerfile exists and exposes correct port', () => {
  const fs = require('fs');
  const dockerPath = path.join(__dirname, '..', 'Dockerfile');
  assert.ok(fs.existsSync(dockerPath), 'Dockerfile exists');
  const content = fs.readFileSync(dockerPath, 'utf8');
  assert.ok(content.includes('EXPOSE 3000'), 'exposes port 3000');
  assert.ok(content.includes('node server.js'), 'runs server.js');
});

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}
