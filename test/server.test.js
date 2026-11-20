'use strict';
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/index');
const { RiderStore } = require('../server/riders');
const { HomeworkReader } = require('../server/homework');

/** Start the app on a free port with a temporary database. */
async function start(homework = new HomeworkReader({ apiKey: '', model: 'm' })) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ua-server-'));
  const app = createApp({ riders: new RiderStore(path.join(dir, 'test.db')), homework });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };
  return { call, base, close: () => server.close() };
}

test('serves the app and its files', async (t) => {
  const s = await start();
  t.after(s.close);
  for (const file of ['/', '/manifest.json', '/icons/icon.svg', '/fonts/baloo2.woff2']) {
    const res = await fetch(s.base + file);
    assert.equal(res.status, 200, file);
  }
});

test('status reports homework off without a key', async (t) => {
  const s = await start();
  t.after(s.close);
  const res = await s.call('GET', '/api/status');
  assert.equal(res.body.homework, false);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('rider lifecycle over HTTP', async (t) => {
  const s = await start();
  t.after(s.close);
  const created = await s.call('POST', '/api/riders', {});
  assert.equal(created.status, 201);
  const id = created.body.id;
  const saved = await s.call('PUT', `/api/riders/${id}/state`, { state: { profile: { name: 'Emma', uni: 'Luna' } }, updatedAt: 5 });
  assert.deepEqual(saved.body, { ok: true, updatedAt: 5 });
  assert.equal((await s.call('GET', '/api/riders')).body[0].name, 'Emma');
  const stale = await s.call('PUT', `/api/riders/${id}/state`, { state: { profile: { name: 'Old' } }, updatedAt: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.state.profile.name, 'Emma');
  assert.equal((await s.call('GET', '/api/riders/99/state')).status, 404);
  assert.equal((await s.call('DELETE', `/api/riders/${id}`)).status, 204);
});

test('homework errors come back as codes', async (t) => {
  const s = await start();
  t.after(s.close);
  const res = await s.call('POST', '/api/homework', { images: [] });
  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'not_configured');
});

test('homework with a key passes the reply through', async (t) => {
  const client = { beta: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok": true, "problems": []}' }] }) } } };
  const s = await start(new HomeworkReader({ apiKey: '', model: 'm', client }));
  t.after(s.close);
  assert.equal((await s.call('GET', '/api/status')).body.homework, true);
  const res = await s.call('POST', '/api/homework', { images: [{ mediaType: 'image/png', data: 'aGk=' }], plan: {} });
  assert.deepEqual(res.body, { ok: true, problems: [] });
});
