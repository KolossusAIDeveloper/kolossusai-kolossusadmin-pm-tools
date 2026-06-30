const assert = require('assert');
const fs = require('fs');
const path = require('path');

function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (err) { console.error(`✗ ${name}: ${err.message}`); process.exitCode = 1; }
}

test('repo has a React client and Node server', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'client', 'src', 'App.jsx')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'server.js')));
});

test('pmClient includes task creation and assignee support', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'api', 'pmClient.js'), 'utf8');
  assert.ok(content.includes('createTask'));
  assert.ok(content.includes('assignee'));
  assert.ok(content.includes('listStatuses'));
});

test('UI includes create task and disconnect actions', () => {
  const board = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'BoardView.jsx'), 'utf8');
  const navbar = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'Navbar.jsx'), 'utf8');
  assert.ok(board.includes('Create Task'));
  assert.ok(navbar.includes('Disconnect'));
});
