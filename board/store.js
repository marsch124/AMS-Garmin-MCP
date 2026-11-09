// AMS Garmin Board — the few things the board keeps on this Mac:
// settings (targets, weekly plan, notification switch, access code), the Captain's log,
// the travel marker, and which red alerts the Mac was already told about today.
// Small JSON files in ~/Library/Application Support/AMS Garmin MCP/board/, written atomically.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_STORE_DIR = join(homedir(), 'Library', 'Application Support', 'AMS Garmin MCP', 'board');
export const DEFAULT_TARGETS = Object.freeze({ steps: 300000, workouts: 12, swims: 0, runs: 0, trainingMinutes: 900, distanceKm: 0 });
/** The weekly workout plan (1.4): how many of each kind a week. 0 = not planned. */
export const DEFAULT_PLAN = Object.freeze({ runs: 0, strength: 0, swims: 0, rides: 0, hikes: 0, walks: 0, yoga: 0 });
export const LOG_MAX_CHARS = 200;
export const HOME_ZONE = 'Europe/Stockholm';

const TARGET_KEYS = Object.keys(DEFAULT_TARGETS);
const PLAN_KEYS = Object.keys(DEFAULT_PLAN);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Reads a map of non-negative whole numbers, keeping the defaults for anything odd. */
function readCounts(raw, defaults, keys) {
  const out = { ...defaults };
  for (const k of keys) {
    const v = Number(raw?.[k]);
    if (Number.isFinite(v) && v >= 0) out[k] = Math.round(v);
  }
  return out;
}
/** Merges a patch of counts; a negative or non-number is refused with a plain message. */
function mergeCounts(target, patch, keys, word) {
  if (!patch || typeof patch !== 'object') return;
  for (const k of keys) {
    if (patch[k] === undefined || patch[k] === null || patch[k] === '') continue;
    const v = Number(patch[k]);
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`The ${word} "${k}" must be a number of 0 or more.`);
    target[k] = Math.round(v);
  }
}

export class BoardStore {
  constructor(dir = DEFAULT_STORE_DIR) {
    this.dir = dir;
  }

  async #read(name, fallback) {
    try {
      return JSON.parse(await readFile(join(this.dir, name), 'utf8'));
    } catch {
      return fallback;
    }
  }

  async #write(name, value) {
    await mkdir(this.dir, { recursive: true });
    const tmp = join(this.dir, `${name}.${process.pid}.tmp`);
    await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    await rename(tmp, join(this.dir, name));
  }

  // ---------- settings ----------

  /** Targets, the weekly plan, the notification switch and the access code (the code is only shown on the Mac itself). */
  async settings() {
    const raw = await this.#read('settings.json', {});
    const targets = readCounts(raw?.targets, DEFAULT_TARGETS, TARGET_KEYS);
    const plan = readCounts(raw?.plan, DEFAULT_PLAN, PLAN_KEYS);
    const notify = raw?.notify !== false;
    const accessCode = typeof raw?.accessCode === 'string' && raw.accessCode.trim() ? raw.accessCode.trim() : '';
    return { targets, plan, notify, accessCode };
  }

  /** Merges targets, plan, notify and/or accessCode into the saved settings. Returns the new settings. */
  async saveSettings(patch = {}) {
    const current = await this.settings();
    const next = { targets: { ...current.targets }, plan: { ...current.plan }, notify: current.notify, accessCode: current.accessCode };
    mergeCounts(next.targets, patch.targets, TARGET_KEYS, 'target');
    mergeCounts(next.plan, patch.plan, PLAN_KEYS, 'plan');
    if (patch.notify !== undefined) {
      if (typeof patch.notify !== 'boolean') throw new RangeError('The notification switch must be on or off.');
      next.notify = patch.notify;
    }
    if (patch.accessCode !== undefined) {
      if (typeof patch.accessCode !== 'string') throw new RangeError('The access code must be text.');
      const code = patch.accessCode.trim();
      if (code && (code.length < 3 || code.length > 64)) throw new RangeError('The access code needs 3 to 64 characters.');
      next.accessCode = code;
    }
    await this.#write('settings.json', next);
    return next;
  }

  // ---------- Captain's log ----------

  /** All entries, or only one month's (ym = 'YYYY-MM'). */
  async log(ym) {
    const all = await this.#read('captains-log.json', {});
    const entries = {};
    for (const [date, text] of Object.entries(all)) {
      if (!isDay(date) || typeof text !== 'string' || !text) continue;
      if (ym && !date.startsWith(ym)) continue;
      entries[date] = text;
    }
    return entries;
  }

  /** Sets one day's line; empty text deletes it. Returns that month's entries. */
  async saveLogLine(date, text) {
    if (!isDay(date)) throw new RangeError('The day must look like YYYY-MM-DD.');
    if (typeof text !== 'string') throw new RangeError('The log line must be text.');
    const line = text.replace(/\s+/g, ' ').trim();
    if (line.length > LOG_MAX_CHARS) throw new RangeError(`A log line holds at most ${LOG_MAX_CHARS} characters.`);
    const all = await this.#read('captains-log.json', {});
    if (line) all[date] = line; else delete all[date];
    await this.#write('captains-log.json', all);
    return this.log(date.slice(0, 7));
  }

  // ---------- travel ----------

  /** Records the time zone the page runs in. Away from home → the first day away is kept. */
  async noteZone(zone, today, homeZone = HOME_ZONE) {
    const current = await this.#read('travel.json', null);
    if (!zone || typeof zone !== 'string' || zone === homeZone) {
      if (current) await this.#write('travel.json', null);
      return null;
    }
    const since = current && isDay(current.since) && current.zone === zone ? current.since : (current && isDay(current.since) ? current.since : today);
    const next = { since, zone };
    if (!current || current.since !== since || current.zone !== zone) await this.#write('travel.json', next);
    return next;
  }

  async travel() {
    const t = await this.#read('travel.json', null);
    return t && isDay(t.since) && typeof t.zone === 'string' ? { since: t.since, zone: t.zone } : null;
  }

  // ---------- red-alert notifications (1.4) ----------

  /** Which alert keys the Mac was already told about, and on which day. */
  async notified() {
    const n = await this.#read('alerts-notified.json', null);
    return n && isDay(n.date) && Array.isArray(n.keys) ? { date: n.date, keys: n.keys.filter((k) => typeof k === 'string') } : { date: null, keys: [] };
  }

  async saveNotified(date, keys) {
    if (!isDay(date)) throw new RangeError('The day must look like YYYY-MM-DD.');
    await this.#write('alerts-notified.json', { date, keys: [...new Set(keys)] });
  }
}
