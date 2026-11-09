// AMS Garmin Board — the few things the board keeps on this Mac:
// settings (targets, access code), the Captain's log, and the travel marker.
// Small JSON files in ~/Library/Application Support/AMS Garmin MCP/board/, written atomically.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_STORE_DIR = join(homedir(), 'Library', 'Application Support', 'AMS Garmin MCP', 'board');
export const DEFAULT_TARGETS = Object.freeze({ steps: 300000, workouts: 12, swims: 0, runs: 0, trainingMinutes: 900, distanceKm: 0 });
export const LOG_MAX_CHARS = 200;
export const HOME_ZONE = 'Europe/Stockholm';

const TARGET_KEYS = Object.keys(DEFAULT_TARGETS);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

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

  /** Targets and the access code (the code itself is only used server-side). */
  async settings() {
    const raw = await this.#read('settings.json', {});
    const targets = { ...DEFAULT_TARGETS };
    for (const k of TARGET_KEYS) {
      const v = Number(raw?.targets?.[k]);
      if (Number.isFinite(v) && v >= 0) targets[k] = Math.round(v);
    }
    const accessCode = typeof raw?.accessCode === 'string' && raw.accessCode.trim() ? raw.accessCode.trim() : '';
    return { targets, accessCode };
  }

  /** Merges targets and/or accessCode into the saved settings. Returns the new settings. */
  async saveSettings(patch = {}) {
    const current = await this.settings();
    const next = { targets: { ...current.targets }, accessCode: current.accessCode };
    if (patch.targets && typeof patch.targets === 'object') {
      for (const k of TARGET_KEYS) {
        if (patch.targets[k] === undefined || patch.targets[k] === null || patch.targets[k] === '') continue;
        const v = Number(patch.targets[k]);
        if (!Number.isFinite(v) || v < 0) throw new RangeError(`The target "${k}" must be a number of 0 or more.`);
        next.targets[k] = Math.round(v);
      }
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
}
