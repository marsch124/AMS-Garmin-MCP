// AMS Garmin Board 1.10.0 — the Gym sessions panel, fed by the iPhone gym app's file. All numbers are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBoard, gymView } from '../board/board-data.js';
import { fakeClient } from './helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const T = '2026-11-18';

const entry = (name, o = {}) => ({ name, muscle: 'Legs', sets: '50 kg × 10, 10', setCount: 2, topKg: 50, pain: false, ...o });
const ses = (id, date, o = {}) => ({
  id, date, start: `${date}T07:00:00Z`, end: `${date}T07:50:00Z`, minutes: 50, gym: 'Invented gym', title: 'Invented day', feel: 'good', notes: null,
  machines: 2, sets: 6, liftedKg: 3000, cardioMinutes: 0, bests: ['Leg press'], entries: [entry('Leg press'), entry('Curl', { pain: true })], ...o,
});
const file = (sessions) => ({ app: 'AMS Workout Companion', format: 1, written: `${T}T09:40:00Z`, sessions });

test('1.10 A: gymView with no file says not available and keeps the shape', () => {
  for (const f of [null, undefined, {}, { sessions: 'nope' }, { sessions: [] }]) {
    const g = gymView(f, T);
    assert.equal(g.available, false);
    assert.equal(g.latest, null);
    assert.deepEqual(g.recent, []);
    assert.deepEqual(g.week, { sessions: 0, minutes: 0, liftedKg: 0 });
  }
});

test('1.10 B: latest, vsPrevious, week and prevWeek come out of an invented file', () => {
  const g = gymView(file([
    ses('a', T, { sets: 9, minutes: 52, liftedKg: 4120 }),
    ses('b', '2026-11-16', { sets: 7, minutes: 58, liftedKg: 3870 }),
    ses('c', '2026-11-11', { minutes: 40, liftedKg: 1000 }),
    ses('d', '2026-11-05', { minutes: 30, liftedKg: 500 }),
  ]), T);
  assert.equal(g.available, true);
  assert.equal(g.latest.id, 'a');
  assert.equal(g.latest.daysAgo, 0);
  assert.deepEqual(g.latest.vsPrevious, { sets: 2, minutes: -6, liftedKg: 250 });
  assert.equal(g.latest.entries.length, 2);
  assert.equal(g.recent.length, 4);
  // last 7 days = 12..18 Nov, the 7 days before = 5..11 Nov
  assert.deepEqual(g.week, { sessions: 2, minutes: 110, liftedKg: 7990 });
  assert.deepEqual(g.prevWeek, { sessions: 2, minutes: 70, liftedKg: 1500 });
  assert.equal(gymView(file([ses('only', T)]), T).latest.vsPrevious, null);
});

test('1.10 C: malformed sessions and entries are tolerated', () => {
  const g = gymView(file([
    null, 'x', { id: 'nodate' }, { id: 'baddate', date: '18/11/2026' },
    { id: 'ok', date: T, minutes: 'lots', sets: -3, feel: 'bouncy', title: null, entries: [null, 5, { name: '' }, { name: 'Row', setCount: 'x', pain: 'yes' }], bests: [3, 'Row'] },
  ]), T);
  assert.equal(g.available, true);
  assert.equal(g.latest.id, 'ok');
  assert.equal(g.latest.minutes, null);
  assert.equal(g.latest.sets, null);
  assert.equal(g.latest.feel, null);
  assert.deepEqual(g.latest.entries, [{ name: 'Row', muscle: null, sets: null, setCount: null, topKg: null, pain: false }]);
  assert.deepEqual(g.latest.bests, ['Row']);
  assert.deepEqual(g.latest.vsPrevious, null);
});

function board(gymFile) {
  const client = fakeClient(async (path) => {
    if (path.startsWith('/activitylist-service/')) return [];
    if (path.startsWith('/usersummary-service/v2/dailysummaries')) return { data: [] };
    return {};
  });
  return buildBoard(client, { today: T, now: () => Date.parse(T + 'T12:00:00Z'), gymFile });
}

test('1.10 D: the board JSON carries gym; a missing or broken file gives the empty state and nothing else breaks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gym-'));
  const good = join(dir, 'good.json');
  await writeFile(good, JSON.stringify(file([ses('a', T)])));
  const b = await board(good);
  assert.equal(b.gym.available, true);
  assert.equal(b.gym.latest.id, 'a');
  const bad = join(dir, 'bad.json');
  await writeFile(bad, '{ "sessions": [ {');
  for (const p of [bad, join(dir, 'missing.json')]) {
    const e = await board(p);
    assert.equal(e.gym.available, false);
    assert.equal(e.ok, true);
    assert.ok(e.recentWorkouts && e.today);
  }
});

test('1.10 E: index.html has the panel and its ids, right after the Workouts panel', async () => {
  const html = await read('board', 'public', 'index.html');
  const pos = (id) => html.indexOf(`id="${id}"`);
  for (const id of ['gym-panel', 'explain-gym', 'gym-summary', 'gym-compare', 'gym-entries', 'gym-week', 'gym-list', 'gym-empty']) assert.ok(pos(id) > 0, id);
  const end = html.indexOf('</section>', pos('workouts-panel'));
  assert.ok(pos('gym-panel') > end && html.slice(end, pos('gym-panel')).replace(/<\/section>|\s/g, '') === '<sectionclass="panelp-c3s12"', 'gym panel directly after workouts');
  assert.match(html, /No gym sessions yet — in Workout Companion: Settings → Garmin Board → choose the AMS Garmin folder in iCloud Drive\./);
  const { version } = JSON.parse(await read('package.json'));
  assert.ok(html.includes(`id="footer-version">${version}<`));
  const css = await read('board', 'public', 'board.css');
  assert.ok((css.match(/#gym-panel/g) || []).length >= 4, 'listed in the breakpoints');
  assert.ok(css.indexOf('1.10.0 · Gym sessions') < css.indexOf('1.7.0 · Rebel console (bright)'), 'gym css before the rebel block');
});

test('1.10 F: explain.js has the gym key', async () => {
  delete globalThis.AMS_EXPLAIN;
  await import(pathToFileURL(join(ROOT, 'board', 'public', 'explain.js')).href + '?gym');
  const ex = globalThis.AMS_EXPLAIN.gym;
  assert.ok(ex && ex.title && ex.summary && ex.more.length >= 3);
});
