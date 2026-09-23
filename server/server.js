/* ============================================================
   server/server.js — Backend sinkronisasi data antar-perangkat
   Node.js + node:sqlite. Endpoint: POST /api/login, GET|POST /api/sync
   ============================================================ */
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'kasirpro.db');

const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS records (
  collection TEXT, id TEXT, updated_at INTEGER, data TEXT, version INTEGER,
  PRIMARY KEY(collection, id)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY, name TEXT, password TEXT, role TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS seq (n INTEGER)`);
db.exec(`CREATE TABLE IF NOT EXISTS tokens (token TEXT, username TEXT, expires INTEGER)`);

function initSeq() {
  const r = db.prepare('SELECT n FROM seq').get();
  if (!r) db.prepare('INSERT INTO seq(n) VALUES(0)').run();
}
initSeq();

function seedUsers() {
  const cnt = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (cnt === 0) {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('admin','Administrator','admin123','admin');
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('owner','Owner','owner123','owner');
  }
}
seedUsers();

const PORT = parseInt(process.env.PORT || '3000');
const tokens = new Map();
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
}
function now() { return Date.now(); }
function nextVersion() {
  const r = db.prepare('UPDATE seq SET n = n + 1').run();
  return db.prepare('SELECT n FROM seq').get().n;
}

function upsertRecord(collection, rec) {
  const id = rec.id, updatedAt = rec.updatedAt || now(), v = nextVersion();
  db.prepare(`INSERT INTO records(collection,id,updated_at,data,version)
              VALUES(?,?,?,?,?)
              ON CONFLICT(collection,id) DO UPDATE SET
              updated_at=excluded.updated_at, data=excluded.data,
              version=CASE WHEN excluded.updated_at > records.updated_at THEN excluded.version ELSE records.version END`).run(
    collection, id, updatedAt, JSON.stringify(rec), v);
  return v;
}

const server = { app: {}, io: {} };

const app = {};

export { db, nextVersion };

function handleLogin(req, res) {
  readBody(req).then(b => {
    try {
      const { username, password } = JSON.parse(b);
      const u = db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(username, password);
      if (!u) return json(res, 401, { error: 'username atau password salah' });
      const token = crypto.randomBytes(24).toString('hex');
      tokens.set(token, { username: u.username, role: u.role, expires: now() + 7*86400000 });
      json(res, 200, { token, user: { username: u.username, name: u.name, role: u.role } });
    } catch(e) { json(res, 400, { error: 'bad request' }); }
  }).catch(() => json(res, 400, { error: 'bad request' }));
}

function auth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  return tokens.get(h.slice(7)) || null;
}

function handleSyncPost(req, res) {
  const u = auth(req);
  if (!u) return json(res, 401, { error: 'belum login' });
  readBody(req).then(async b => {
    try {
      const { collections } = JSON.parse(b);
      const global = nextVersion();
      for (const [coll, items] of Object.entries(collections || {})) {
        if (!Array.isArray(items)) continue;
        for (const rec of items) upsertRecord(coll, rec);
      }
      json(res, 200, { ok: true, version: global });
    } catch(e) { json(res, 400, { error: 'bad request' }); }
  }).catch(() => json(res, 400, { error: 'bad request' }));
}

function handleSyncGet(req, res) {
  const u = auth(req);
  if (!u) return json(res, 401, { error: 'belum login' });
  const since = parseInt((req.url.match(/[?&]since=(\d+)/) || [])[1] || '0');
  const rows = db.prepare(`SELECT collection, id, updated_at, data, version
                           FROM records WHERE version > ? ORDER BY version ASC`).all(since);
  const collections = {};
  for (const r of rows) {
    if (!collections[r.collection]) collections[r.collection] = [];
    const rec = JSON.parse(r.data || '{}');
    rec.updatedAt = r.updated_at;
    rec.version = r.version;
    collections[r.collection].push(rec);
  }
  json(res, 200, { collections, version: db.prepare('SELECT n FROM seq').get().n });
}

const http = await import('http');
const httpServer = http.default.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method === 'POST' && url.pathname === '/api/login') { handleLogin(req, res); return; }
  if (req.method === 'POST' && url.pathname === '/api/sync') { handleSyncPost(req, res); return; }
  if (req.method === 'GET' && url.pathname === '/api/sync') { handleSyncGet(req, res); return; }
  res.writeHead(404, CORS); json(res, 404, { error: 'not found' });
});

httpServer.listen(PORT, () => console.log(`Kasir Pro sync server http://localhost:${PORT}`));
