// AMS Garmin Board 1.8.0 — Workouts panel (today / yesterday / last 7 days). All numbers are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard } from '../board/board-data.js';
import { fakeClient } from './helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const dateAdd = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

const act = (activityId, startTimeLocal, o = {}) => ({
  activityId, activityName: `Invented ${activityId}`, activityType: { typeKey: 'running' }, startTimeLocal,
  duration: 3000, distance: 8000, calories: 400, averageHR: 130, maxHR: 160, elevationGain: 50, ...o,
});

function clientFor(today, acts) {
  return fakeClient(async (path, query) => {
    if (path.startsWith('/activitylist-service/activities/search/activities')) {
      if ((query.start ?? 0) > 0) return [];
      return acts.filter((a) => a.startTimeLocal.slice(0, 10) >= query.startDate && a.startTimeLocal.slice(0, 10) <= query.endDate);
    }
    if (path.startsWith('/usersummary-service/v2/dailysummaries')) return { data: [] };
    return {};
  });
}
const board = (today, acts) => buildBoard(clientFor(today, acts), { today, now: () => Date.parse(today + 'T09:00:00Z') });

test('1.8 A: today, yesterday and last 7 days hold the right workouts, newest first, with totals', async () => {
  const T = '2026-11-09';
  const b = await board(T, [
    act(1, `${T} 08:00:00`, { duration: 3000, distance: 8000, calories: 400 }),
    act(2, `${T} 17:00:00`, { duration: 1800, distance: 5000, calories: 250 }),
    act(3, `${dateAdd(T, -1)} 07:00:00`, { duration: 600, distance: 1000, calories: 100 }),
    act(4, `${dateAdd(T, -3)} 07:00:00`),
  ]);
  const r = b.recentWorkouts;
  assert.deepEqual([r.today.from, r.today.to], [T, T]);
  assert.deepEqual([r.yesterday.from, r.yesterday.to], [dateAdd(T, -1), dateAdd(T, -1)]);
  assert.deepEqual([r.last7.from, r.last7.to], [dateAdd(T, -6), T]);
  assert.equal(r.today.count, 2);
  assert.deepEqual(r.today.list.map((a) => a.id), [2, 1]);
  assert.equal(r.today.seconds, 4800);
  assert.equal(r.today.distanceM, 13000);
  assert.equal(r.today.calories, 650);
  assert.equal(r.yesterday.count, 1);
  assert.equal(r.last7.count, 4);
  assert.deepEqual(r.last7.list.map((a) => a.id), [2, 1, 3, 4]);
});

test('1.8 B: list items are the same objects as board.activities.list items', async () => {
  const T = '2026-11-09';
  const b = await board(T, [act(11, `${T} 08:00:00`)]);
  const item = b.recentWorkouts.today.list[0];
  const same = b.activities.list.find((a) => a.id === 11);
  assert.ok(same);
  assert.deepEqual(item, same);
  for (const k of ['id', 'name', 'type', 'start', 'date', 'seconds', 'distanceM']) assert.ok(k in item, k);
});

test('1.8 C: edges — day 7 ago is out of last 7, day 6 ago is in', async () => {
  const T = '2026-11-09';
  const b = await board(T, [act(21, `${dateAdd(T, -7)} 07:00:00`), act(22, `${dateAdd(T, -6)} 07:00:00`)]);
  const ids = b.recentWorkouts.last7.list.map((a) => a.id);
  assert.ok(ids.includes(22));
  assert.ok(!ids.includes(21));
});

test('1.8 D: last 7 days cross a month start and still include last month', async () => {
  const T = '2026-11-03';
  const b = await board(T, [act(31, '2026-10-29 07:00:00'), act(32, '2026-11-02 07:00:00'), act(33, '2026-10-27 07:00:00')]);
  const ids = b.recentWorkouts.last7.list.map((a) => a.id);
  assert.deepEqual(ids, [32, 31]);
  assert.equal(b.recentWorkouts.last7.from, '2026-10-28');
});

test('1.8 E: page, explanation and version', async () => {
  const html = await read('board', 'public', 'index.html');
  const pos = (id) => html.indexOf(`id="${id}"`);
  for (const id of ['workouts-panel', 'explain-workouts', 'workouts-tab-today', 'workouts-tab-yesterday', 'workouts-tab-last7', 'workouts-summary', 'workouts-list']) assert.ok(pos(id) > 0, id);
  const bb = html.indexOf('</section>', pos('body-battery-panel')) + '</section>'.length;
  assert.match(html.slice(bb, pos('workouts-panel') + 20), /^\s*<section[^>]*id="workouts-panel"/, 'workouts directly after body battery');
  const end = html.indexOf('</section>', pos('workouts-panel'));
  for (const id of ['explain-workouts', 'workouts-tab-today', 'workouts-tab-yesterday', 'workouts-tab-last7', 'workouts-summary', 'workouts-list']) {
    assert.ok(pos(id) > pos('workouts-panel') && pos(id) < end, `${id} inside panel`);
  }
  assert.ok(pos('heart-panel') > pos('sleep-debt-panel'), 'heart panel after sleep debt');
  assert.match(await read('board', 'public', 'explain.js'), /["']?workouts["']?\s*:\s*\{/);
  assert.match(JSON.parse(await read('package.json')).version, /^1\.(8|9|[1-9]\d)\./);
});
