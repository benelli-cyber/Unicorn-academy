'use strict';
/**
 * Riders (children) and their saved progress, stored in SQLite (better-sqlite3).
 *
 * Table: riders(id, created_at, state, updated_at)
 *   - state is the whole app state for one child, as JSON text (coins, skills,
 *     unicorn look, rewards, homework...). The browser owns its shape; the
 *     server only checks it is a JSON object of a sane size.
 *   - updated_at is the browser's save time in milliseconds. A save older than
 *     what is stored is refused (409) so a stale tab can't overwrite newer
 *     progress from another device.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const MAX_STATE_BYTES = 256 * 1024;

/** Error with an HTTP status, so routes can return 400/404/409 without guessing. */
class RiderError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

class RiderStore {
  /** @param {string} file  path to the .db file (its folder is created if needed) */
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`CREATE TABLE IF NOT EXISTS riders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`);
  }

  /** Short list for the "Who's riding today?" picker. */
  list() {
    return this.db.prepare('SELECT id, state, updated_at FROM riders ORDER BY id').all().map((row) => {
      let profile = null;
      try { profile = JSON.parse(row.state).profile || null; } catch { /* unreadable row: still listed */ }
      return {
        id: row.id,
        name: profile && typeof profile.name === 'string' ? profile.name.slice(0, 20) : '',
        uni: profile && typeof profile.uni === 'string' ? profile.uni.slice(0, 20) : '',
        updatedAt: row.updated_at,
      };
    });
  }

  create() {
    const info = this.db.prepare('INSERT INTO riders (created_at) VALUES (?)').run(new Date().toISOString());
    return { id: Number(info.lastInsertRowid) };
  }

  get(id) {
    const row = this.db.prepare('SELECT state, updated_at FROM riders WHERE id = ?').get(toId(id));
    if (!row) throw new RiderError(404, 'No such rider');
    return { state: JSON.parse(row.state), updatedAt: row.updated_at };
  }

  /** Save a rider's state. Refuses saves older than the stored one. */
  put(id, state, updatedAt) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new RiderError(400, 'state must be an object');
    if (!Number.isFinite(updatedAt)) throw new RiderError(400, 'updatedAt must be a number');
    const text = JSON.stringify(state);
    if (Buffer.byteLength(text) > MAX_STATE_BYTES) throw new RiderError(400, 'state is too large');
    const current = this.get(id);
    if (updatedAt < current.updatedAt) throw new RiderError(409, 'A newer save exists', current);
    this.db.prepare('UPDATE riders SET state = ?, updated_at = ? WHERE id = ?').run(text, Math.round(updatedAt), toId(id));
    return { ok: true, updatedAt: Math.round(updatedAt) };
  }

  remove(id) {
    const info = this.db.prepare('DELETE FROM riders WHERE id = ?').run(toId(id));
    if (!info.changes) throw new RiderError(404, 'No such rider');
  }

  close() {
    this.db.close();
  }
}

function toId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new RiderError(400, 'Bad rider id');
  return id;
}

module.exports = { RiderStore, RiderError, MAX_STATE_BYTES };
