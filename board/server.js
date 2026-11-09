#!/usr/bin/env node
// AMS Garmin Board — a tiny web server on this Mac that serves the board page
// and one JSON answer with everything the page draws. Reachable from this Mac only.
//
//   node board/server.js [--port 7788]

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GarminClient, FileTokenStore, readApiKey, GarminError } from '../src/garmin-client.js';
import { VERSION } from '../src/tools.js';
import { buildBoard } from './board-data.js';

export const DEFAULT_PORT = 7788;
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');
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

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function plainError(err) {
  if (err instanceof GarminError) return err.message;
  return `Something went wrong talking to Garmin: ${err?.message || String(err)}`;
}

async function sendFile(res, urlPath) {
  // Only files inside board/public, never anything above it.
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  if (clean.includes('..')) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad path');
    return;
  }
  const rel = clean === '/' || clean === '' ? '/index.html' : clean;
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + '/')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'content-length': data.length,
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

/**
 * Creates the HTTP server (not yet listening).
 * The board JSON is cached for cacheMs (5 minutes) so a reload does not hammer Garmin;
 * /api/board?refresh=1 skips the cache.
 */
export function createBoardServer({ client, now = () => Date.now(), cacheMs = 5 * 60 * 1000, today } = {}) {
  let cache = null; // { at, body }
  let pending = null;

  async function boardJson(force) {
    if (!force && cache && now() - cache.at < cacheMs) return cache.body;
    if (!pending) {
      pending = buildBoard(client, { now, ...(today ? { today } : {}) })
        .then((body) => { cache = { at: now(), body }; return body; })
        .finally(() => { pending = null; });
    }
    return pending;
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    if (url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, version: VERSION });
      return;
    }
    if (url.pathname === '/api/board') {
      try {
        const body = await boardJson(url.searchParams.get('refresh') === '1');
        sendJson(res, 200, body);
      } catch (err) {
        sendJson(res, 503, { ok: false, error: plainError(err), version: VERSION });
      }
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { ok: false, error: 'No such page.' });
      return;
    }
    await sendFile(res, url.pathname);
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
    client = { async get() { throw err; }, async tokenInfo() { return null; } };
  }
  const server = createBoardServer({ client });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  process.stderr.write(`[ams-garmin-board] version ${VERSION} at http://127.0.0.1:${port}/\n`);
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
