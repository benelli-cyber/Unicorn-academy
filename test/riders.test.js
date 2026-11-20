'use strict';
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RiderStore, RiderError } = require('../server/riders');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ua-riders-'));
  return new RiderStore(path.join(dir, 'test.db'));
}

test('create, save and load a rider', () => {
  const store = tempStore();
  const { id } = store.create();
  assert.equal(id, 1);
  assert.deepEqual(store.get(id), { state: {}, updatedAt: 0 });
  store.put(id, { profile: { name: 'Emma', uni: 'Luna' }, coins: 20 }, 1000);
  assert.deepEqual(store.get(id), { state: { profile: { name: 'Emma', uni: 'Luna' }, coins: 20 }, updatedAt: 1000 });
  assert.deepEqual(store.list(), [{ id: 1, name: 'Emma', uni: 'Luna', updatedAt: 1000 }]);
});

test('an older save is refused with the newer state attached', () => {
  const store = tempStore();
  const { id } = store.create();
  store.put(id, { coins: 50 }, 2000);
  assert.throws(() => store.put(id, { coins: 10 }, 1500), (err) => {
    assert.ok(err instanceof RiderError);
    assert.equal(err.status, 409);
    assert.deepEqual(err.extra, { state: { coins: 50 }, updatedAt: 2000 });
    return true;
  });
  assert.equal(store.get(id).state.coins, 50);
});

test('bad input is rejected', () => {
  const store = tempStore();
  const { id } = store.create();
  assert.throws(() => store.put(id, [1, 2], 1), { status: 400 });
  assert.throws(() => store.put(id, 'text', 1), { status: 400 });
  assert.throws(() => store.put(id, {}, NaN), { status: 400 });
  assert.throws(() => store.put(id, { big: 'x'.repeat(300 * 1024) }, 1), { status: 400 });
  assert.throws(() => store.get(99), { status: 404 });
  assert.throws(() => store.get('abc'), { status: 400 });
});

test('removing a rider', () => {
  const store = tempStore();
  const { id } = store.create();
  store.remove(id);
  assert.deepEqual(store.list(), []);
  assert.throws(() => store.remove(id), { status: 404 });
});
