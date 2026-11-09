// AMS Garmin Board 1.6.0 — Peek: history of a number on hover / press and hold. Tests written before the code. All numbers are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { buildBoard } from '../board/board-data.js';
import { createBoardServer } from '../board/server.js';
import { fakeClient } from './helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'board', 'public');
const TODAY = '2026-11-09'; // a Monday
const NOW = Date.parse('2026-11-09T09:00:00Z');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const tmp = () => mkdtemp(join(tmpdir(), 'board16-'));

// ---------- fixtures ----------
const dateAdd = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dowOf = (iso) => new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); // Sun = 0
const STEPS_BY_DOW = { 0: 4000, 1: 8000, 2: 8000, 3: 8000, 4: 8000, 5: 8000, 6: 12000 }; // weakest Sunday, strongest Saturday
const GAP = '2026-10-01'; // a day without a resting pulse
const idx = (date) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86400000);
const restingOf = (date) => (date.startsWith('2025') ? 54 : 48 + (idx(date) % 6));
const stressOf = (date) => 18 + (idx(date) % 5);

function longDay(date, { todayResting = 52 } = {}) {
  const isToday = date === TODAY;
  const n = isToday ? 340 : date.startsWith('2025') ? 6000 : STEPS_BY_DOW[dowOf(date)];
  const resting = isToday ? todayResting : date === GAP ? null : restingOf(date);
  return {
    calendarDate: date,
    movement: { steps: { goal: 10000, value: n, distanceInMeters: n * 0.8 }, floorsAscended: { goal: 10, value: 20 } },
    calories: { burnedResting: 2000, burnedActive: 700, burnedTotal: 2700 },
    heartRate: { minValue: 45, maxValue: 140, restingValue: resting },
    intensityMinutes: { goal: 600, moderate: 20, vigorous: 5 },
    stress: { avgLevel: stressOf(date), maxLevel: 70 },
    bodyBattery: { minValue: 30, maxValue: 90, chargedValue: 50, drainedValue: 50, latestValue: 60 },
    respiration: { avgValue: 12 },
  };
}
function longDays(opts) {
  const list = [];
  for (let d = '2025-01-01'; d <= TODAY; d = dateAdd(d, 1)) list.push(longDay(d, opts));
  return list;
}

const act = (activityId, startTimeLocal, typeKey, load, o = {}) => ({
  activityId, activityName: `Invented ${activityId}`, activityType: { typeKey }, startTimeLocal,
  duration: 3000, distance: 8000, calories: 400, averageHR: 130, maxHR: 160, elevationGain: 50,
  activityTrainingLoad: load, hrTimeInZone_1: 0, hrTimeInZone_2: 0, hrTimeInZone_3: 0, hrTimeInZone_4: 0, hrTimeInZone_5: 0,
  ...o,
});
const ACTS = [
  act(101, '2026-11-09 08:00:00', 'running', 100, { vO2MaxValue: 52 }),
  act(102, '2026-11-06 07:00:00', 'hiking', 60),
  act(103, '2026-11-01 07:00:00', 'lap_swimming', 80),
  act(104, '2026-10-20 07:00:00', 'running', 100, { vO2MaxValue: 50 }),
  act(105, '2026-10-25 07:00:00', 'strength_training', 100),
  act(106, '2026-10-28 07:00:00', 'hiking', 100),
  act(107, '2026-10-05 07:00:00', 'running', 500, { vO2MaxValue: 49 }),
];
const ACTS_2025 = [
  act(301, '2025-11-03 07:00:00', 'running', 70),
  act(302, '2025-11-05 07:00:00', 'strength_training', 60),
  act(303, '2025-02-10 07:00:00', 'running', 50),
];
const actsOverride = (list) => ({
  '/activitylist-service/activities/search/activities': (path, query) => ((query.start ?? 0) > 0 ? [] : list.filter((a) => a.startTimeLocal.slice(0, 10) >= query.startDate && a.startTimeLocal.slice(0, 10) <= query.endDate)),
});

const NIGHTS = [3, 4, 5, 6, 7, 8, 9].map((d) => ({
  calendarDate: `2026-11-0${d}`, sleepTimeSeconds: 420 * 60, napTimeSeconds: 600, sleepNeed: { actual: 460 },
}));
const WEIGHTS = [['2026-09-15', 82000], ['2026-10-15', 81500], ['2026-11-05', 81000]]
  .map(([summaryDate, weight]) => ({ summaryDate, latestWeight: { weight, date: Date.parse(summaryDate + 'T07:00:00Z') } }));
const BB_REPORT = [{
  date: TODAY,
  bodyBatteryValuesArray: [[Date.parse('2026-11-09T00:00:00Z'), 80], [Date.parse('2026-11-09T06:00:00Z'), 70], [Date.parse('2026-11-09T09:00:00Z'), 60]],
  bodyBatteryActivityEvent: [{ eventType: 'SLEEP', eventStartTimeGmt: '2026-11-08T22:30:00.0', durationInMilliseconds: 25200000, bodyBatteryImpact: 40 }],
}];

function makeClient(over = {}, extra = {}, opts = {}) {
  return fakeClient(async (path, query) => {
    const hit = Object.entries(over).find(([p]) => path.startsWith(p));
    if (hit) { const v = hit[1]; return typeof v === 'function' ? v(path, query) : v; }
    if (path.startsWith('/usersummary-service/v2/dailysummaries')) {
      return { data: longDays(opts).filter((d) => d.calendarDate >= query.startDate && d.calendarDate <= query.endDate) };
    }
    if (path.startsWith('/activitylist-service/activities/search/activities')) {
      if ((query.start ?? 0) > 0) return [];
      return ACTS.filter((a) => a.startTimeLocal.slice(0, 10) >= query.startDate && a.startTimeLocal.slice(0, 10) <= query.endDate);
    }
    if (path.startsWith('/sleep-service/sleep/dailySleepSummariesByDate')) return NIGHTS;
    if (path.startsWith('/sleep-service/sleep/dailySleep')) return { dailySleepDTO: { sleepTimeSeconds: 0 } };
    if (path.startsWith('/hrv-service/hrv/')) return {};
    if (path.startsWith('/weight-service/weight/range/')) return { dailyWeightSummaries: WEIGHTS };
    if (path.startsWith('/goal-service/goal/user/effective/weightgoal')) return { userGoals: [{ userGoalType: 'WEIGHT_GRAMS', goalValue: 80000 }] };
    if (path.startsWith('/fitnessage-service/fitnessage/')) return { chronologicalAge: 60, fitnessAge: 49, previousFitnessAge: 50 };
    if (path.startsWith('/biometric-service/heartRateZones')) return [{ sport: 'DEFAULT', zone1Floor: 100, zone2Floor: 115, zone3Floor: 130, zone4Floor: 145, zone5Floor: 160, maxHeartRateUsed: 175 }];
    if (path.startsWith('/wellness-service/wellness/bodyBattery/reports/daily')) return BB_REPORT;
    if (path.startsWith('/usersummary-service/stats/hydration/daily/')) return [];
    if (path.startsWith('/usersummary-service/usersummary/daily')) return { lastSyncTimestampGMT: '2026-11-09T06:02:15.751' };
    throw new Error('unexpected ' + path);
  }, extra);
}

async function withServer(client, fn, { storeDir, remoteAddressOf, notify } = {}) {
  const dir = storeDir ?? await tmp();
  const server = createBoardServer({ client, now: () => NOW, cacheMs: 60000, today: TODAY, storeDir: dir, remoteAddressOf, notify });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base, dir); } finally { await new Promise((r) => server.close(r)); server.closeAllConnections?.(); }
}

const KEYS = ['steps', 'distance', 'resting-hr', 'hr-min', 'hr-max', 'stress', 'stress-max', 'respiration', 'body-battery', 'calories', 'calories-active', 'floors', 'intensity', 'sleep', 'weight', 'hydration'];

test('1.6 A: package.json version is x.y.z and the CHANGELOG starts with it', async () => {
  const { version } = JSON.parse(await read('package.json'));
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const first = (await read('CHANGELOG.md')).split('\n').find((l) => l.startsWith('## '));
  assert.ok(first.startsWith(`## ${version}`), first);
});

test('1.6 B: /api/board returns history series and an updated block', async () => {
  await withServer(makeClient(), async (base) => {
    const j = await (await fetch(base + '/api/board')).json();
    assert.ok(j.history && typeof j.history === 'object', 'history present');
    for (const k of ['steps', 'resting-hr', 'stress', 'calories', 'floors', 'intensity']) {
      const s = j.history[k];
      assert.ok(Array.isArray(s) && s.length > 0, 'series ' + k);
      for (const p of s) {
        assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(Number.isFinite(p.value), k + ' value');
      }
      const dates = s.map((p) => p.date);
      assert.deepEqual(dates, [...dates].sort(), k + ' sorted oldest first');
      assert.ok(s.length <= 90, k + ' at most 90 days');
    }
    assert.ok(j.updated && 'watchSyncedAt' in j.updated, 'watchSyncedAt property');
    assert.ok(!Number.isNaN(Date.parse(j.updated.fetchedAt)), 'fetchedAt is a date');
    assert.match(j.updated.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('1.6 C: index.html has the peek card and the data-peek marks', async () => {
  const html = await read('board', 'public', 'index.html');
  assert.match(html, /<div[^>]*id="peek-card"[^>]*\bhidden\b|<div[^>]*\bhidden\b[^>]*id="peek-card"/);
  for (const id of ['peek-title', 'peek-value', 'peek-rows', 'peek-avg', 'peek-updated']) assert.ok(html.includes(`id="${id}"`), id);
  const vals = [...html.matchAll(/data-peek="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(vals.length >= 15, 'data-peek count ' + vals.length);
  assert.deepEqual(vals.filter((v) => !KEYS.includes(v)), []);
});

test('1.6 D: board.js and board.css carry the peek behaviour and style', async () => {
  const js = await read('board', 'public', 'board.js');
  for (const s of ['data-peek', 'pointerdown', 'mouseover', 'peek-updated']) assert.ok(js.includes(s), s);
  const css = await read('board', 'public', 'board.css');
  assert.match(css, /#peek-card\s*\{[^}]*position:\s*fixed/);
});

test('1.6 E: the README board section explains press and hold', async () => {
  const md = await read('README.md');
  const section = md.split(/^## /m).find((s) => s.startsWith('The board'));
  assert.ok(section, 'section present');
  assert.ok(/press and hold/i.test(section), 'press and hold');
});
