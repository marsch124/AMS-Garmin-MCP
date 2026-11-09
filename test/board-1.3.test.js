// AMS Garmin Board 1.3.0 — tests written before the code. All numbers are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, constants } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBoard } from '../board/board-data.js';
import { createBoardServer } from '../board/server.js';
import { GarminError } from '../src/garmin-client.js';
import { fakeClient } from './helpers.js';
import { buildFitZip } from './fit-fixture.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'board', 'public');
const TODAY = '2026-11-09';
const NOW = Date.parse('2026-11-09T09:00:00Z');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const tmp = () => mkdtemp(join(tmpdir(), 'board13-'));

// ---------- fixtures ----------
const day = (date, o = {}) => ({
  calendarDate: date,
  movement: { steps: { goal: 10000, value: 10000, distanceInMeters: 8000 }, floorsAscended: { goal: 10, value: 20 } },
  calories: { burnedResting: 2000, burnedActive: 700, burnedTotal: 2700 },
  heartRate: { minValue: 45, maxValue: 140, restingValue: 50 },
  intensityMinutes: { goal: 600, moderate: 20, vigorous: 5 },
  stress: { avgLevel: 20, maxLevel: 70 },
  bodyBattery: { minValue: 30, maxValue: 90, chargedValue: 50, drainedValue: 50, latestValue: 60 },
  respiration: { avgValue: 12 },
  ...o,
});
const steps = (n) => ({ movement: { steps: { goal: 10000, value: n, distanceInMeters: n * 0.8 }, floorsAscended: { goal: 10, value: 20 } } });

function daysFixture({ todayResting = 52, todayBB = 60 } = {}) {
  const list = [];
  for (let d = 1; d <= 12; d++) list.push(day(`2026-10-${String(d).padStart(2, '0')}`)); // 12 goal days in a row
  list.push(day('2026-11-05'), day('2026-11-06'));                                       // met, met
  list.push(day('2026-11-07', steps(9000)));                                              // missed
  list.push(day('2026-11-08', steps(12000)));                                             // met
  list.push(day(TODAY, {
    ...steps(340),
    heartRate: { minValue: 55, maxValue: 90, restingValue: todayResting },
    bodyBattery: { minValue: 30, maxValue: 90, chargedValue: 5, drainedValue: 5, latestValue: todayBB },
  }));
  return list;
}

const act = (activityId, startTimeLocal, typeKey, load, o = {}) => ({
  activityId, activityName: `Invented ${activityId}`, activityType: { typeKey }, startTimeLocal,
  duration: 3000, distance: 8000, calories: 400, averageHR: 130, maxHR: 160, elevationGain: 50,
  activityTrainingLoad: load, hrTimeInZone_1: 0, hrTimeInZone_2: 0, hrTimeInZone_3: 0, hrTimeInZone_4: 0, hrTimeInZone_5: 0,
  ...o,
});
const ACTS = [
  act(101, '2026-11-09 08:00:00', 'running', 100, { vO2MaxValue: 52, hrTimeInZone_1: 60, hrTimeInZone_2: 120, hrTimeInZone_3: 180, hrTimeInZone_4: 240, hrTimeInZone_5: 300 }),
  act(102, '2026-11-06 07:00:00', 'hiking', 60, { hrTimeInZone_1: 999, hrTimeInZone_3: 999 }), // last week: not in this week's zones
  act(103, '2026-11-01 07:00:00', 'lap_swimming', 80),
  act(104, '2026-10-20 07:00:00', 'running', 100, { vO2MaxValue: 50, startLatitude: 40.1234, startLongitude: -3.4567 }),
  act(105, '2026-10-25 07:00:00', 'strength_training', 100),
  act(106, '2026-10-28 07:00:00', 'hiking', 100),
  act(107, '2026-10-05 07:00:00', 'running', 500, { vO2MaxValue: 49 }),
];
// acute (Nov 3..9) = 100 + 60 = 160; chronic (Oct 13..Nov 9) = (100+60+80+100+100+100)/4 = 135; ratio 1.185 -> PRODUCTIVE

const NIGHTS = [3, 4, 5, 6, 7, 8, 9].map((d) => ({
  calendarDate: `2026-11-0${d}`, sleepTimeSeconds: 420 * 60, napTimeSeconds: 600, sleepNeed: { actual: 460 },
}));
const WEIGHTS = [['2026-09-15', 82000], ['2026-09-30', 81800], ['2026-10-15', 81500], ['2026-10-31', 81250], ['2026-11-05', 81000]]
  .map(([summaryDate, weight]) => ({ summaryDate, latestWeight: { weight, date: Date.parse(summaryDate + 'T07:00:00Z') } }));
const BB_REPORT = [{
  date: TODAY,
  bodyBatteryValuesArray: [[Date.parse('2026-11-09T00:00:00Z'), 80], [Date.parse('2026-11-09T03:00:00Z'), 90], [Date.parse('2026-11-09T06:00:00Z'), 70], [Date.parse('2026-11-09T09:00:00Z'), 60]],
  bodyBatteryActivityEvent: [{ eventType: 'SLEEP', eventStartTimeGmt: '2026-11-08T22:30:00.0', durationInMilliseconds: 25200000, bodyBatteryImpact: 40 }],
}];

function makeClient(over = {}, extra = {}, opts = {}) {
  return fakeClient(async (path, query) => {
    const hit = Object.entries(over).find(([p]) => path.startsWith(p));
    if (hit) { const v = hit[1]; return typeof v === 'function' ? v(path, query) : v; }
    if (path.startsWith('/usersummary-service/v2/dailysummaries')) {
      const all = daysFixture(opts);
      return { data: all.filter((d) => d.calendarDate >= query.startDate && d.calendarDate <= query.endDate) };
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
    if (path.startsWith('/usersummary-service/usersummary/daily')) return { lastSyncTimestampGMT: '2026-11-09T06:02:15.751' };
    throw new Error('unexpected ' + path);
  }, extra);
}

const build = async (over, opts) => buildBoard(makeClient(over, {}, opts), { today: TODAY, now: () => NOW, storeDir: await tmp() });

async function withServer(client, fn, { storeDir, fetchFn, remoteAddressOf } = {}) {
  const dir = storeDir ?? await tmp();
  const server = createBoardServer({ client, now: () => NOW, cacheMs: 60000, today: TODAY, storeDir: dir, fetchFn, remoteAddressOf });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base, dir); } finally { await new Promise((r) => server.close(r)); server.closeAllConnections?.(); }
}
const put = (url, body, headers = {}) => fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });


import { reportText } from '../board/board-data.js';

// ---------- A. version and docs ----------
test('1.3 A: package.json version is 1.3.0 or later', async () => {
  const v = JSON.parse(await read('package.json')).version;
  assert.match(v, /^\d+\.\d+\.\d+$/);
  const [a, b, c] = v.split('.').map(Number);
  assert.ok(a > 1 || (a === 1 && (b > 3 || (b === 3 && c >= 0))), v);
});
test('1.3 A: CHANGELOG has a 1.3.0 entry and starts with a version heading', async () => {
  const lines = (await read('CHANGELOG.md')).split('\n');
  assert.match(lines.find((l) => l.startsWith('## ')), /^## \d+\.\d+\.\d+/);
  assert.ok(lines.some((l) => l.startsWith('## 1.3.0')));
});

// ---------- B. zones fallback ----------
const onlyActs = (list) => ({
  '/activitylist-service/activities/search/activities': (path, query) => ((query.start ?? 0) > 0 ? [] : list.filter((a) => a.startTimeLocal.slice(0, 10) >= query.startDate && a.startTimeLocal.slice(0, 10) <= query.endDate)),
});
test('1.3 B: zones use this week when it has activities', async () => {
  const z = (await build()).zones;
  assert.equal(z.period, 'week');
  assert.equal(z.since, '2026-11-09');
});
test('1.3 B: zones fall back to the last 7 days when this week is empty', async () => {
  const a = act(201, '2026-11-06 07:00:00', 'running', 50, { hrTimeInZone_1: 10, hrTimeInZone_2: 20, hrTimeInZone_3: 30, hrTimeInZone_4: 40, hrTimeInZone_5: 50 });
  const z = (await build(onlyActs([a]))).zones;
  assert.equal(z.period, 'last7');
  assert.equal(z.since, '2026-11-03');
  assert.deepEqual(z.secondsInZone, [10, 20, 30, 40, 50]);
  assert.equal(z.total, 150);
});
test('1.3 B: no activities in 7 days keeps the week with total 0', async () => {
  const z = (await build(onlyActs([]))).zones;
  assert.equal(z.period, 'week');
  assert.equal(z.total, 0);
});

// ---------- C. steps chip ----------
test('1.3 C: stepsCompare against 12 October', async () => {
  const c = (await build()).today.stepsCompare;
  assert.deepEqual(c, { date: '2026-10-12', steps: 10000, delta: 340 - 10000, pct: Math.round(((340 - 10000) / 10000) * 100) });
});
test('1.3 C: stepsCompare has nulls when that day has no data', async () => {
  const over = { '/usersummary-service/v2/dailysummaries': (path, query) => ({ data: daysFixture().filter((d) => d.calendarDate !== '2026-10-12' && d.calendarDate >= query.startDate && d.calendarDate <= query.endDate) }) };
  const c = (await build(over)).today.stepsCompare;
  assert.deepEqual(c, { date: '2026-10-12', steps: null, delta: null, pct: null });
});

// ---------- D. sleep nudge ----------
test('1.3 D: missingRecent is 0 when the last nights are recorded', async () => {
  assert.equal((await build()).sleepDebt.missingRecent, 0);
});
test('1.3 D: missingRecent is 3 when the last three nights have no sleep time', async () => {
  const nights = NIGHTS.map((n) => (n.calendarDate >= '2026-11-07' ? { ...n, sleepTimeSeconds: 0 } : n));
  const d = (await build({ '/sleep-service/sleep/dailySleepSummariesByDate': nights })).sleepDebt;
  assert.equal(d.missingRecent, 3);
});

// ---------- E. report ----------
test('1.3 E: report has a Sleep line with hours and a numeric summary', async () => {
  const board = await build();
  const r = reportText('week', board);
  const line = r.text.split('\n').find((l) => l.startsWith('Sleep:'));
  assert.ok(line, 'Sleep line');
  assert.match(line, /h/);
  const s = r.summary;
  assert.ok(s && typeof s === 'object');
  for (const k of ['steps', 'stepGoalDays', 'days', 'workouts', 'trainingSeconds', 'distanceKm', 'restingHrAvg', 'intensityMinutes']) assert.equal(typeof s[k], 'number', k);
  assert.ok('sleepAvgMin' in s && (s.sleepAvgMin === null || typeof s.sleepAvgMin === 'number'));
});
test('1.3 E: /api/report?kind=week carries summary.steps', async () => {
  await withServer(makeClient(), async (base) => {
    const j = await (await fetch(base + '/api/report?kind=week')).json();
    assert.equal(j.ok, true);
    assert.equal(typeof j.summary.steps, 'number');
  });
});

// ---------- F. page ----------
test('1.3 F: index.html has the new ids', async () => {
  const html = await read('board', 'public', 'index.html');
  for (const id of ['zones-note', 'zones-total-label', 'steps-chip', 'sleep-nudge']) assert.ok(html.includes(`id="${id}"`), id);
});
test('1.3 F: board.js uses the new elements', async () => {
  const js = await read('board', 'public', 'board.js');
  for (const id of ['zones-note', 'steps-chip', 'sleep-nudge']) assert.ok(js.includes(id), id);
});
test('1.3 F: explain.js zones summary mentions the last 7 days', async () => {
  delete globalThis.AMS_EXPLAIN;
  await import(pathToFileURL(join(PUB, 'explain.js')).href + '?v13');
  assert.ok(globalThis.AMS_EXPLAIN.zones.summary.includes('last 7 days'));
});

// ---------- G. report.sh ----------
test('1.3 G: report.sh saves into iCloud Drive and writes a .json file', async () => {
  const s = await read('scripts', 'report.sh');
  assert.ok(s.includes('Mobile Documents/com~apple~CloudDocs/AMS Garmin'));
  assert.ok(s.includes('.json'));
});
