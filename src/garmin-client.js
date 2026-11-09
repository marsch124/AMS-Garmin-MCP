// AMS Garmin — the part that talks to Garmin.
// It turns Martin's personal API key into a 24-hour access token and fetches data.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const BASE_URL = 'https://personal.connectapi.garmin.com';
export const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
export const APP_DIR = join(homedir(), 'Library', 'Application Support', 'AMS Garmin MCP');
export const KEY_FILE = join(APP_DIR, 'api-key');
export const TOKEN_FILE = join(APP_DIR, 'token.json');
export const ENV_KEY = 'GARMIN_PERSONAL_API_KEY';

const DEFAULT_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const SAFETY_MARGIN_MS = 5 * 60 * 1000;

export class GarminError extends Error {
  constructor(message, { code = 'GARMIN', status, body } = {}) {
    super(message);
    this.name = 'GarminError';
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

export const NO_KEY_MESSAGE =
  'No Garmin key saved yet. Create a Personal API key at ' +
  'https://connect.garmin.com/app/settings/personalApiToken and save it with scripts/save-key.sh ' +
  `(it goes to ${KEY_FILE}).`;

/** Reads the personal API key: the environment variable wins, then the key file. */
export async function readApiKey({ env = process.env, keyFile = KEY_FILE } = {}) {
  const fromEnv = (env[ENV_KEY] || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const text = (await readFile(keyFile, 'utf8')).trim();
    if (text) return text;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  throw new GarminError(NO_KEY_MESSAGE, { code: 'NO_KEY' });
}

export class MemoryTokenStore {
  #value = null;
  async load() { return this.#value; }
  async save(value) { this.#value = value; }
  async clear() { this.#value = null; }
}

export class FileTokenStore {
  constructor(file = TOKEN_FILE) { this.file = file; }
  async load() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data && typeof data.token === 'string' && typeof data.expiresAt === 'number') return data;
      return null;
    } catch {
      return null;
    }
  }
  async save(value) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    await writeFile(this.file, JSON.stringify(value), { mode: 0o600 });
  }
  async clear() {
    await rm(this.file, { force: true });
  }
}

function pickToken(body) {
  // Garmin answers the token request with the bare token as plain text (a JWT).
  if (typeof body === 'string') return body.trim() || null;
  if (!body || typeof body !== 'object') return null;
  return body.access_token || body.accessToken || body.token || null;
}

/** Reads the expiry ("exp", seconds since 1970) out of a JWT, if the token is one. */
export function jwtExpiryMs(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function pickLifetimeMs(body, token, nowMs) {
  const seconds = body?.expires_in ?? body?.expiresIn ?? body?.expires_in_seconds;
  if (typeof seconds === 'number' && seconds > 0) return seconds * 1000;
  if (typeof body?.expiresAt === 'string') {
    const t = Date.parse(body.expiresAt);
    if (!Number.isNaN(t)) return Math.max(0, t - nowMs);
  }
  const exp = jwtExpiryMs(token);
  if (exp && exp > nowMs) return exp - nowMs;
  return DEFAULT_TOKEN_LIFETIME_MS;
}

export function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readBody(response) {
  const type = response.headers?.get?.('content-type') || '';
  const text = await response.text();
  if (!text) return null;
  if (type.includes('json')) {
    try { return JSON.parse(text); } catch { return text; }
  }
  try { return JSON.parse(text); } catch { return text; }
}

export class GarminClient {
  constructor({ apiKey, fetch = globalThis.fetch, tokenStore = new MemoryTokenStore(), now = () => Date.now(), baseUrl = BASE_URL } = {}) {
    if (!apiKey) throw new GarminError(NO_KEY_MESSAGE, { code: 'NO_KEY' });
    this.apiKey = apiKey;
    this.fetch = fetch;
    this.tokenStore = tokenStore;
    this.now = now;
    this.baseUrl = baseUrl;
  }

  /** Returns a valid access token, minting a new one from the key when needed. */
  async getToken() {
    const cached = await this.tokenStore.load();
    if (cached && cached.expiresAt - SAFETY_MARGIN_MS > this.now()) return cached.token;
    return this.#mintToken();
  }

  async tokenInfo() {
    return this.tokenStore.load();
  }

  async #mintToken() {
    const response = await this.fetch(this.baseUrl + TOKEN_PATH, {
      method: 'POST',
      // No Accept header on purpose: Garmin answers 406 when asked for JSON here.
      headers: { Authorization: `ApiKey ${this.apiKey}` },
    });
    const body = await readBody(response);
    if (!response.ok) {
      const hint = response.status === 401 || response.status === 403
        ? 'Garmin did not accept the key. It may have expired or been deleted; create a new one at https://connect.garmin.com/app/settings/personalApiToken and save it again.'
        : `Garmin could not issue an access token (HTTP ${response.status}).`;
      throw new GarminError(hint, { code: 'TOKEN', status: response.status, body });
    }
    const token = pickToken(body);
    if (!token) throw new GarminError('Garmin answered without an access token.', { code: 'TOKEN', status: response.status, body });
    const value = { token, expiresAt: this.now() + pickLifetimeMs(body, token, this.now()) };
    await this.tokenStore.save(value);
    return token;
  }

  async #request(path, query, { binary = false } = {}, retry = true) {
    const token = await this.getToken();
    const url = buildUrl(this.baseUrl, path, query);
    const response = await this.fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: binary ? '*/*' : 'application/json' },
    });
    if (response.status === 401 && retry) {
      await this.tokenStore.clear();
      return this.#request(path, query, { binary }, false);
    }
    if (!response.ok) {
      const body = await readBody(response);
      const text = response.status === 401 || response.status === 403
        ? 'Garmin rejected the access token even after a fresh one. The Personal API key may have expired or been deleted; create a new one at https://connect.garmin.com/app/settings/personalApiToken and save it again.'
        : response.status === 404
        ? `Garmin has no data for that request (${path}).`
        : response.status === 429
          ? 'Garmin is asking us to slow down (too many requests). Try again in a minute.'
          : `Garmin answered with HTTP ${response.status} for ${path}.`;
      throw new GarminError(text, { code: 'HTTP', status: response.status, body });
    }
    if (response.status === 204) return binary ? { buffer: Buffer.alloc(0), contentType: '', filename: null } : null;
    if (binary) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers?.get?.('content-type') || '';
      const disposition = response.headers?.get?.('content-disposition') || '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      return { buffer, contentType, filename: match ? decodeURIComponent(match[1]) : null };
    }
    return readBody(response);
  }

  /** GET a JSON endpoint. Re-mints the token once on 401. */
  async get(path, query = {}) {
    return this.#request(path, query);
  }

  /** GET a binary endpoint (the original activity file). */
  async getBinary(path, query = {}) {
    return this.#request(path, query, { binary: true });
  }
}
