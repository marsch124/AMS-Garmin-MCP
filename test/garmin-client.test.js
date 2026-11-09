import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BASE_URL, TOKEN_PATH, ENV_KEY, GarminError, readApiKey, MemoryTokenStore, FileTokenStore,
  buildUrl, GarminClient,
} from '../src/garmin-client.js';
import { fakeFetch, jsonResponse, binaryResponse } from './helpers.js';

const T0 = Date.parse('2026-11-01T10:00:00Z');
const isMint = (c) => c.url === BASE_URL + TOKEN_PATH;

function makeClient(handler, { now = () => T0, tokenStore = new MemoryTokenStore() } = {}) {
  const fetch = fakeFetch(handler);
  const client = new GarminClient({ apiKey: 'KEY1', fetch, tokenStore, now });
  return { client, fetch, tokenStore };
}

test('buildUrl skips empty values and repeats arrays', () => {
  const url = new URL(buildUrl('https://x.test', '/a/b', { a: 1, b: undefined, c: null, d: '', e: 0, f: false, g: ['x', 'y'] }));
  assert.equal(url.pathname, '/a/b');
  assert.equal(url.searchParams.get('a'), '1');
  assert.equal(url.searchParams.has('b'), false);
  assert.equal(url.searchParams.has('c'), false);
  assert.equal(url.searchParams.has('d'), false);
  assert.equal(url.searchParams.get('e'), '0');
  assert.equal(url.searchParams.get('f'), 'false');
  assert.deepEqual(url.searchParams.getAll('g'), ['x', 'y']);
});

test('readApiKey: env wins over file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'garmin-'));
  const keyFile = join(dir, 'api-key');
  await writeFile(keyFile, 'FILEKEY\n');
  assert.equal(await readApiKey({ env: { [ENV_KEY]: 'ENVKEY' }, keyFile }), 'ENVKEY');
  assert.equal(await readApiKey({ env: {}, keyFile }), 'FILEKEY');
});

test('readApiKey: neither env nor file throws NO_KEY', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'garmin-'));
  await assert.rejects(readApiKey({ env: {}, keyFile: join(dir, 'missing') }), (e) => e instanceof GarminError && e.code === 'NO_KEY');
});

test('constructor without apiKey throws NO_KEY', () => {
  assert.throws(() => new GarminClient({}), (e) => e instanceof GarminError && e.code === 'NO_KEY');
});

test('MemoryTokenStore load/save/clear', async () => {
  const s = new MemoryTokenStore();
  assert.equal(await s.load(), null);
  await s.save({ token: 'a', expiresAt: 1 });
  assert.deepEqual(await s.load(), { token: 'a', expiresAt: 1 });
  await s.clear();
  assert.equal(await s.load(), null);
});

test('FileTokenStore load/save/clear', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'garmin-'));
  const file = join(dir, 'sub', 'token.json');
  const s = new FileTokenStore(file);
  assert.equal(await s.load(), null);
  await s.save({ token: 'a', expiresAt: 5 });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { token: 'a', expiresAt: 5 });
  assert.deepEqual(await s.load(), { token: 'a', expiresAt: 5 });
  await s.clear();
  assert.equal(await s.load(), null);
});

test('getToken POSTs with ApiKey header and caches with expiresAt', async () => {
  const { client, fetch, tokenStore } = makeClient(() => jsonResponse(200, { access_token: 'TOK', expires_in: 3600 }));
  assert.equal(await client.getToken(), 'TOK');
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].method, 'POST');
  assert.equal(fetch.calls[0].url, BASE_URL + TOKEN_PATH);
  assert.equal(fetch.calls[0].headers.Authorization, 'ApiKey KEY1');
  assert.deepEqual(await tokenStore.load(), { token: 'TOK', expiresAt: T0 + 3600 * 1000 });
  assert.equal(await client.getToken(), 'TOK');
  assert.equal(fetch.calls.length, 1, 'reused while valid');
});

for (const field of ['access_token', 'accessToken', 'token']) {
  test(`getToken accepts ${field}`, async () => {
    const { client } = makeClient(() => jsonResponse(200, { [field]: 'T-' + field }));
    assert.equal(await client.getToken(), 'T-' + field);
  });
}

test('getToken defaults to 24 h lifetime', async () => {
  const { client, tokenStore } = makeClient(() => jsonResponse(200, { access_token: 'X' }));
  await client.getToken();
  assert.equal((await tokenStore.load()).expiresAt, T0 + 24 * 3600 * 1000);
});

test('token expiring in 2 minutes is re-minted; in 10 minutes is reused', async () => {
  let n = 0;
  const { client, fetch, tokenStore } = makeClient(() => jsonResponse(200, { access_token: 'N' + ++n, expires_in: 86400 }));
  await tokenStore.save({ token: 'OLD', expiresAt: T0 + 2 * 60 * 1000 });
  assert.equal(await client.getToken(), 'N1');
  await tokenStore.save({ token: 'OK', expiresAt: T0 + 10 * 60 * 1000 });
  assert.equal(await client.getToken(), 'OK');
  assert.equal(fetch.calls.length, 1);
});

test('rejected key (POST 401) throws TOKEN mentioning the Garmin key page', async () => {
  const { client } = makeClient(() => jsonResponse(401, { error: 'nope' }));
  await assert.rejects(client.getToken(), (e) => {
    assert.ok(e instanceof GarminError);
    assert.equal(e.code, 'TOKEN');
    assert.equal(e.status, 401);
    assert.match(e.message, /connect\.garmin\.com\/app\/settings\/personalApiToken/);
    return true;
  });
});

test('get() sends Bearer token, query string, returns parsed JSON', async () => {
  const { client, fetch } = makeClient((c) => (isMint(c)
    ? jsonResponse(200, { access_token: 'TOK' })
    : jsonResponse(200, { hello: 'world' })));
  const data = await client.get('/foo/bar', { a: 1, skip: undefined, list: ['x', 'y'] });
  assert.deepEqual(data, { hello: 'world' });
  const call = fetch.calls.find((c) => !isMint(c));
  assert.equal(call.method, 'GET');
  assert.equal(call.headers.Authorization, 'Bearer TOK');
  const u = new URL(call.url);
  assert.equal(u.origin + u.pathname, BASE_URL + '/foo/bar');
  assert.equal(u.searchParams.get('a'), '1');
  assert.equal(u.searchParams.has('skip'), false);
  assert.deepEqual(u.searchParams.getAll('list'), ['x', 'y']);
});

test('401 clears the store, mints a new token, retries exactly once', async () => {
  let mints = 0;
  const { client, fetch } = makeClient((c) => {
    if (isMint(c)) return jsonResponse(200, { access_token: 'TOK' + ++mints });
    return c.headers.Authorization === 'Bearer TOK2' ? jsonResponse(200, { ok: 1 }) : jsonResponse(401, {});
  });
  assert.deepEqual(await client.get('/x'), { ok: 1 });
  assert.equal(mints, 2);
  assert.equal(fetch.calls.filter((c) => !isMint(c)).length, 2);
});

test('401 twice gives up after one retry', async () => {
  const { client, fetch } = makeClient((c) => (isMint(c) ? jsonResponse(200, { access_token: 'T' }) : jsonResponse(401, {})));
  await assert.rejects(client.get('/x'), (e) => e instanceof GarminError && e.status === 401);
  assert.equal(fetch.calls.filter((c) => !isMint(c)).length, 2);
});

test('404 message says no data', async () => {
  const { client } = makeClient((c) => (isMint(c) ? jsonResponse(200, { access_token: 'T' }) : jsonResponse(404, {})));
  await assert.rejects(client.get('/x'), (e) => e instanceof GarminError && e.status === 404 && /no data/i.test(e.message));
});

test('429 message says slow down', async () => {
  const { client } = makeClient((c) => (isMint(c) ? jsonResponse(200, { access_token: 'T' }) : jsonResponse(429, {})));
  await assert.rejects(client.get('/x'), (e) => e instanceof GarminError && e.status === 429 && /slow down/i.test(e.message));
});

test('getBinary returns buffer, contentType and filename from Content-Disposition', async () => {
  const { client } = makeClient((c) => (isMint(c)
    ? jsonResponse(200, { access_token: 'T' })
    : binaryResponse(200, [1, 2, 3, 4], { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="run_123.zip"' })));
  const r = await client.getBinary('/download-service/files/activity/123');
  assert.deepEqual([...r.buffer], [1, 2, 3, 4]);
  assert.equal(r.contentType, 'application/zip');
  assert.equal(r.filename, 'run_123.zip');
});

test('tokenInfo returns the stored token', async () => {
  const { client } = makeClient(() => jsonResponse(200, { access_token: 'T', expires_in: 60 }));
  assert.equal(await client.tokenInfo(), null);
  await client.getToken();
  assert.equal((await client.tokenInfo()).token, 'T');
});
