#!/usr/bin/env node
// AMS Garmin Board — a tiny web server on this Mac that serves the board page
// and the JSON answers the page draws. Reachable from this Mac; from the home
// network only once an access code is set in Settings.
//
//   node board/server.js [--port 7788]

import http from 'node:http';
import os from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GarminClient, FileTokenStore, readApiKey, GarminError } from '../src/garmin-client.js';
import { VERSION } from '../src/tools.js';
import { buildBoard, buildMonth, reportText, travelView, nextMonth } from './board-data.js';
import { BoardStore, DEFAULT_STORE_DIR, HOME_ZONE } from './store.js';
import { createWeather, HOME_PLACE } from './weather.js';
import { workoutFromFile } from './fit.js';

export const DEFAULT_PORT = 7788;
export const CODE_COOKIE = 'ams-board-code';
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT_DIR, 'board', 'public');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const DAY_MS = 86_400_000;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}
function sendText(res, status, text, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'content-length': Buffer.byteLength(text), ...headers });
  res.end(text);
}
function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...headers });
  res.end();
}

function plainError(err) {
  if (err instanceof GarminError) return err.message;
  return `Something went wrong talking to Garmin: ${err?.message || String(err)}`;
}
function statusOf(err) {
  if (err instanceof RangeError) return 400;
  if (err instanceof GarminError && err.status === 404) return 404;
  return 503;
}

async function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new RangeError('That is too much to send at once.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const text = await readBody(req);
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new RangeError('The request body must be a JSON object.');
  }
}
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const isLoopback = (addr) => {
  const a = String(addr || '').replace(/^::ffff:/, '');
  return a === '::1' || a === 'localhost' || a.startsWith('127.');
};

/** The address a phone on the same Wi‑Fi types to reach the board. */
export function lanAddress(port = DEFAULT_PORT) {
  const host = os.hostname().replace(/\.(local|lan|home|fritz\.box)$/i, '');
  let ip = null;
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal && !ip) ip = i.address;
    }
  }
  const name = `http://${host.toLowerCase()}.local:${port}/`;
  return ip ? `${name} (or http://${ip}:${port}/)` : name;
}

async function sendFile(res, urlPath, headOnly = false) {
  // Only files inside board/public, never anything above it.
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  if (clean.includes('..')) { sendText(res, 400, 'Bad path'); return; }
  const rel = clean === '/' || clean === '' ? '/index.html' : clean;
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + '/')) { sendText(res, 404, 'Not found'); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'content-length': data.length,
    });
    res.end(headOnly ? undefined : data);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

function codePage(message = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AMS Garmin Board · Code</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#3d3a44;color:#f7efe4;font-family:'Antonio','Arial Narrow','Helvetica Neue',Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em}
form{display:flex;flex-direction:column;gap:14px;width:min(320px,86vw)}h1{font-size:22px;margin:0;color:#ff9966}p{margin:0;font-size:14px;color:#b3a899}
input{font:inherit;font-size:22px;padding:10px 14px;border-radius:999px;border:0;background:#524e59;color:#f7efe4;text-align:center;letter-spacing:.2em}
button{font:inherit;font-size:16px;font-weight:700;padding:10px 18px;border-radius:999px;border:0;background:#ff9966;color:#1a171c;cursor:pointer}.err{color:#cc6666}</style></head>
<body><form method="post" action="/code"><h1>AMS Garmin Board</h1><p>Type the code from Settings on the Mac.</p>
${message ? `<p class="err">${message}</p>` : ''}
<input id="code" name="code" type="password" autocomplete="current-password" autofocus required>
<button type="submit">Open the board</button></form></body></html>`;
}

const docsSection = (md, heading) => {
  const i = md.indexOf(`\n${heading}`);
  if (i < 0) return '';
  const rest = md.slice(i + 1);
  const next = rest.indexOf('\n## ', heading.length);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
};

/**
 * Creates the HTTP server (not yet listening).
 * The board JSON is cached for cacheMs (5 minutes) so a reload does not hammer Garmin;
 * /api/board?refresh=1 skips the cache. Past months are cached for a day, workouts for good.
 */
export function createBoardServer({
  client, now = () => Date.now(), cacheMs = 5 * 60 * 1000, today, storeDir, store,
  fetchFn, remoteAddressOf, homeZone = HOME_ZONE, port = DEFAULT_PORT, onAccessCodeChange,
} = {}) {
  const st = store ?? new BoardStore(storeDir ?? DEFAULT_STORE_DIR);
  const weather = createWeather({ fetchFn, now });
  const remoteOf = remoteAddressOf ?? ((req) => req.socket?.remoteAddress ?? '');
  const todayOf = () => today ?? new Date(now()).toLocaleDateString('sv-SE');
  let cache = null; // { at, body }
  let pending = null;
  const monthCache = new Map();    // ym -> { at, body }
  const activityCache = new Map(); // id -> body

  async function boardJson(force) {
    if (!force && cache && now() - cache.at < cacheMs) return cache.body;
    if (!pending) {
      pending = buildBoard(client, { now, today: todayOf(), store: st, homeZone })
        .then((body) => { cache = { at: now(), body }; return body; })
        .finally(() => { pending = null; });
    }
    return pending;
  }

  async function monthJson(ym) {
    const current = todayOf().slice(0, 7);
    if (ym === current) {
      const b = await boardJson(false);
      return { ok: true, ym, month: b.month, activities: b.activities, compare: b.compare, log: b.log };
    }
    const hit = monthCache.get(ym);
    if (hit && now() - hit.at < DAY_MS) return hit.body;
    const body = await buildMonth(client, ym, { today: todayOf(), store: st });
    monthCache.set(ym, { at: now(), body });
    return body;
  }

  async function activityJson(id) {
    if (activityCache.has(id)) return activityCache.get(id);
    const detail = await client.get(`/activity-service/activity/${id}`);
    const warnings = [];
    let file = null;
    try {
      file = await client.getBinary(`/download-service/files/activity/${id}`);
    } catch (err) {
      warnings.push(`file: ${err?.message || String(err)}`);
    }
    const w = file?.buffer ? workoutFromFile(file.buffer) : { splits: { kind: 'laps', list: [] }, hr: [], altitude: [], trace: [] };
    const s = detail?.summaryDTO ?? {};
    const r = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
    const body = {
      ok: true,
      id: Number(id),
      name: detail?.activityName ?? '',
      type: detail?.activityTypeDTO?.typeKey ?? detail?.activityType?.typeKey ?? 'other',
      start: s.startTimeLocal ?? null,
      seconds: r(s.duration),
      distanceM: r(s.distance),
      calories: r(s.calories),
      avgHr: r(s.averageHR),
      maxHr: r(s.maxHR),
      elevationGain: r(s.elevationGain),
      place: detail?.locationName ?? null,
      splitsKind: w.splits.kind,
      splits: w.splits.list,
      hr: w.hr,
      altitude: w.altitude,
      trace: w.trace,
      warnings,
    };
    activityCache.set(id, body);
    return body;
  }

  async function settingsJson() {
    const s = await st.settings();
    return { ok: true, settings: { targets: s.targets, hasAccessCode: !!s.accessCode, lanAddress: lanAddress(port) } };
  }

  async function defaultPlace() {
    try {
      const b = await boardJson(false);
      const limit = todayOf();
      const from = new Date(Date.parse(limit) - 10 * DAY_MS).toISOString().slice(0, 10);
      const a = (b.context?.acts ?? []).find((x) => x.lat !== null && x.lon !== null && x.date >= from);
      if (a) return { lat: a.lat, lon: a.lon, source: 'workout', name: a.place ? String(a.place).toUpperCase() : 'LATEST WORKOUT' };
    } catch { /* fall through to home */ }
    return { ...HOME_PLACE };
  }

  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const path = url.pathname;
    const local = isLoopback(remoteOf(req));

    // ---------- the home-network gate ----------
    if (!local) {
      const settings = await st.settings();
      const given = parseCookies(req.headers.cookie)[CODE_COOKIE];
      const open = !!settings.accessCode && given === settings.accessCode;
      if (path === '/code') {
        if (method === 'GET') { sendText(res, open ? 200 : 200, codePage(), 'text/html; charset=utf-8'); return; }
        if (method === 'POST') {
          const body = await readBody(req);
          const code = new URLSearchParams(body).get('code')?.trim() ?? '';
          if (settings.accessCode && code === settings.accessCode) {
            redirect(res, '/', { 'set-cookie': `${CODE_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax` });
          } else {
            sendText(res, 403, codePage(settings.accessCode ? 'That code is not right.' : 'No code is set on the Mac yet.'), 'text/html; charset=utf-8');
          }
          return;
        }
      }
      if (!open) {
        if (path.startsWith('/api/')) { sendJson(res, 403, { ok: false, error: 'The board needs the access code on this network.' }); return; }
        redirect(res, '/code');
        return;
      }
      if (path === '/api/settings' && method !== 'GET') {
        sendJson(res, 403, { ok: false, error: 'Settings can only be changed on the Mac itself.' });
        return;
      }
    } else if (path === '/code') {
      redirect(res, '/');
      return;
    }

    // ---------- JSON routes ----------
    if (path.startsWith('/api/')) {
      try {
        if (method === 'GET' && path === '/api/health') return sendJson(res, 200, { ok: true, version: VERSION });
        if (method === 'GET' && path === '/api/board') return sendJson(res, 200, await boardJson(url.searchParams.get('refresh') === '1'));
        if (method === 'GET' && path === '/api/month') {
          const ym = url.searchParams.get('ym') || todayOf().slice(0, 7);
          return sendJson(res, 200, await monthJson(ym));
        }
        if (method === 'GET' && /^\/api\/activity\/\d{1,20}$/.test(path)) return sendJson(res, 200, await activityJson(path.slice('/api/activity/'.length)));
        if (method === 'GET' && path === '/api/weather') {
          const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
          const place = Number.isFinite(lat) && Number.isFinite(lon) && url.searchParams.has('lat')
            ? { lat, lon, source: 'browser', name: 'WHERE YOU ARE' }
            : await defaultPlace();
          const forecast = await weather.forecast(place);
          return sendJson(res, 200, { ok: true, place: { ...place, lat: Math.round(place.lat * 100) / 100, lon: Math.round(place.lon * 100) / 100 }, ...forecast });
        }
        if (path === '/api/settings' && method === 'GET') return sendJson(res, 200, await settingsJson());
        if (path === '/api/settings' && method === 'PUT') {
          const before = (await st.settings()).accessCode;
          const after = await st.saveSettings(await readJson(req));
          const out = await settingsJson();
          if (!!before !== !!after.accessCode) onAccessCodeChange?.(!!after.accessCode);
          return sendJson(res, 200, out);
        }
        if (method === 'GET' && path === '/api/log') {
          const ym = url.searchParams.get('ym') || todayOf().slice(0, 7);
          return sendJson(res, 200, { ok: true, ym, entries: await st.log(ym) });
        }
        if (method === 'PUT' && /^\/api\/log\/\d{4}-\d{2}-\d{2}$/.test(path)) {
          const date = path.slice('/api/log/'.length);
          const { text } = await readJson(req);
          const entries = await st.saveLogLine(date, text ?? '');
          if (cache?.body && date.slice(0, 7) === todayOf().slice(0, 7)) cache.body.log = entries;
          monthCache.delete(date.slice(0, 7));
          return sendJson(res, 200, { ok: true, ym: date.slice(0, 7), entries });
        }
        if (method === 'POST' && path === '/api/travel') {
          const { zone } = await readJson(req);
          const stored = await st.noteZone(typeof zone === 'string' ? zone : '', todayOf(), homeZone);
          const b = await boardJson(false).catch(() => null);
          const travel = travelView(stored, b?.context?.allDays ?? [], todayOf());
          if (b) b.travel = travel;
          return sendJson(res, 200, { ok: true, travel });
        }
        if (method === 'GET' && path === '/api/report') {
          const kind = url.searchParams.get('kind') === 'month' ? 'month' : 'week';
          const b = await boardJson(false);
          return sendJson(res, 200, { ok: true, ...reportText(kind, b, todayOf()) });
        }
        if (method === 'GET' && path === '/api/docs') {
          const [readme, changelog] = await Promise.all([
            readFile(join(ROOT_DIR, 'README.md'), 'utf8').catch(() => ''),
            readFile(join(ROOT_DIR, 'CHANGELOG.md'), 'utf8').catch(() => ''),
          ]);
          return sendJson(res, 200, { ok: true, version: VERSION, howItWorks: docsSection(readme, '## The board'), whatsNew: changelog.trim() });
        }
        if (method !== 'GET' && method !== 'PUT' && method !== 'POST') {
          res.writeHead(405, { allow: 'GET, HEAD, PUT, POST' });
          res.end();
          return;
        }
        return sendJson(res, 404, { ok: false, error: 'No such page.' });
      } catch (err) {
        return sendJson(res, statusOf(err), { ok: false, error: err instanceof RangeError ? err.message : plainError(err), version: VERSION });
      }
    }

    if (method !== 'GET') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    await sendFile(res, path, req.method === 'HEAD');
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: err?.message || String(err) });
      else res.end();
    });
  });
}

/** Builds the real Garmin client from the saved key (same key the Claude connection uses). */
export async function realClient() {
  const apiKey = await readApiKey();
  return new GarminClient({ apiKey, tokenStore: new FileTokenStore() });
}

export async function startBoard({ port = DEFAULT_PORT } = {}) {
  let client;
  try {
    client = await realClient();
  } catch (err) {
    // No key yet: still serve the page so it can show what is wrong.
    process.stderr.write(`[ams-garmin-board] ${err?.message || err}\n`);
    client = { async get() { throw err; }, async getBinary() { throw err; }, async tokenInfo() { return null; } };
  }
  const store = new BoardStore();
  let host = (await store.settings()).accessCode ? '0.0.0.0' : '127.0.0.1';
  let server;
  const listen = () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      process.stderr.write(`[ams-garmin-board] version ${VERSION} at http://127.0.0.1:${port}/${host === '0.0.0.0' ? ' and on the home network' : ''}\n`);
      resolve();
    });
  });
  server = createBoardServer({
    client, store, port,
    onAccessCodeChange(hasCode) {
      // Re-bind so the home network is (or is no longer) reachable, after the answer went out.
      const next = hasCode ? '0.0.0.0' : '127.0.0.1';
      if (next === host) return;
      host = next;
      setTimeout(() => {
        server.close(() => listen().catch((err) => process.stderr.write(`[ams-garmin-board] could not re-bind: ${err?.message || err}\n`)));
        server.closeIdleConnections?.();
        setTimeout(() => server.closeAllConnections?.(), 2000);
      }, 200);
    },
  });
  await listen();
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return server;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const i = process.argv.indexOf('--port');
  const port = i > -1 ? Number(process.argv[i + 1]) : DEFAULT_PORT;
  startBoard({ port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT }).catch((err) => {
    process.stderr.write(`[ams-garmin-board] failed to start: ${err?.stack || err}\n`);
    process.exit(1);
  });
}
