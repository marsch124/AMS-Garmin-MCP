// AMS Garmin Board 1.9.0 — workout markers on the Body Battery curve, "vs the 7 days before". All numbers are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, parseGmt } from '../board/board-data.js';
import { fakeClient } from './helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const dateAdd = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const T = '2026-11-09';

const act = (activityId, startTimeLocal, o = {}) => ({
  activityId, activityName: `Invented ${activityId}`, activityType: { typeKey: 'running' }, startTimeLocal,
  duration: 3000, distance: 8000, calories: 400, averageHR: 130, maxHR: 160, elevationGain: 50, ...o,
});

function board(acts, bbReport = []) {
  const client = fakeClient(async (path, query) => {
    if (path.startsWith('/activitylist-service/activities/search/activities')) {
      if ((query.start ?? 0) > 0) return [];
      return acts.filter((a) => a.startTimeLocal.slice(0, 10) >= query.startDate && a.startTimeLocal.slice(0, 10) <= query.endDate);
    }
    if (path.startsWith('/usersummary-service/v2/dailysummaries')) return { data: [] };
    if (path.startsWith('/wellness-service/wellness/bodyBattery/reports/daily')) return bbReport;
    return {};
  });
  return buildBoard(client, { today: T, now: () => Date.parse(T + 'T12:00:00Z') });
}

const bbDay = (points, events = []) => [{ date: T, bodyBatteryValuesArray: points, bodyBatteryActivityEvent: events }];

test('1.9 A: startMs comes from startTimeGMT, null when missing', async () => {
  const b = await board([
    act(1, `${T} 10:00:00`, { startTimeGMT: `${T}T09:10:08.0` }),
    act(2, `${T} 11:00:00`),
  ]);
  const by = (id) => b.activities.list.find((a) => a.id === id);
  assert.equal(by(1).startMs, Date.parse(`${T}T09:10:08Z`));
  assert.equal(by(1).startMs, parseGmt(`${T}T09:10:08.0`));
  assert.equal(by(2).startMs, null);
});

test('1.9 B: prev7 covers today-13..today-7 and vsLastWeek is last7 minus prev7', async () => {
  const b = await board([
    act(11, `${T} 08:00:00`, { duration: 3600, distance: 10000, calories: 500 }),
    act(12, `${dateAdd(T, -2)} 08:00:00`, { duration: 1800, distance: 5000, calories: 200 }),
    act(13, `${dateAdd(T, -7)} 08:00:00`, { duration: 600, distance: 1000, calories: 100 }),
    act(14, `${dateAdd(T, -13)} 08:00:00`, { duration: 600, distance: 2000, calories: 100 }),
    act(15, `${dateAdd(T, -14)} 08:00:00`),
  ]);
  const r = b.recentWorkouts;
  assert.deepEqual([r.prev7.from, r.prev7.to], [dateAdd(T, -13), dateAdd(T, -7)]);
  assert.deepEqual(r.prev7.list.map((a) => a.id).sort(), [13, 14]);
  assert.equal(r.prev7.count, 2);
  assert.deepEqual(r.vsLastWeek, { count: 0, seconds: 3600 + 1800 - 1200, distanceM: 15000 - 3000, calories: 700 - 200 });
  assert.ok(r.prev7.distanceM === 3000 && r.prev7.seconds === 1200);
});

test('1.9 C: workout marker drain comes from the matching ACTIVITY event', async () => {
  const start = Date.parse(`${T}T09:00:00Z`);
  const b = await board(
    [act(21, `${T} 10:00:00`, { startTimeGMT: `${T}T09:00:00.0`, duration: 3000 })],
    bbDay([[start - 600000, 70], [start + 3600000, 50]], [{ eventType: 'ACTIVITY', eventStartTimeGmt: `${T}T09:05:00.0`, durationInMilliseconds: 3000000, bodyBatteryImpact: -17 }]),
  );
  const w = b.bodyBatteryCurve.workouts;
  assert.equal(w.length, 1);
  assert.deepEqual(w[0], { id: 21, name: 'Invented 21', type: w[0].type, startMs: start, endMs: start + 3000 * 1000, drain: 17 });
});

test('1.9 D: without an event the drain is the reading before the start minus the reading after the end; null if impossible', async () => {
  const start = Date.parse(`${T}T09:00:00Z`);
  const end = start + 3000 * 1000;
  const a = act(31, `${T} 10:00:00`, { startTimeGMT: `${T}T09:00:00.0`, duration: 3000 });
  const withReadings = await board([a], bbDay([[start - 60000, 72], [end + 60000, 55]]));
  assert.equal(withReadings.bodyBatteryCurve.workouts[0].drain, 17);
  const noReadings = await board([a], bbDay([]));
  assert.equal(noReadings.bodyBatteryCurve.workouts[0].drain, null);
});

test('1.9 E: page has the compare line and the curve markers', async () => {
  assert.ok((await read('board', 'public', 'index.html')).includes('id="workouts-compare"'));
  assert.ok((await read('board', 'public', 'board.js')).includes('bb-wk-'));
});
