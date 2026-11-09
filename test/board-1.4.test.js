// AMS Garmin Board 1.4.0 — tests written before the code. All numbers are invented.
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
const tmp = () => mkdtemp(join(tmpdir(), 'board14-'));

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

const build = async (over, opts) => buildBoard(makeClient(over, {}, opts), { today: TODAY, now: () => NOW, storeDir: await tmp() });

async function withServer(client, fn, { storeDir, remoteAddressOf, notify } = {}) {
  const dir = storeDir ?? await tmp();
  const server = createBoardServer({ client, now: () => NOW, cacheMs: 60000, today: TODAY, storeDir: dir, remoteAddressOf, notify });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base, dir); } finally { await new Promise((r) => server.close(r)); server.closeAllConnections?.(); }
}
const put = (url, body, headers = {}) => fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

// ---------- A. version and docs ----------
test('1.4 A: package.json version is 1.4.0', async () => {
  assert.equal(JSON.parse(await read('package.json')).version, '1.4.0');
});
test('1.4 A: /api/health reports 1.4.0', async () => {
  await withServer(makeClient(), async (base) => {
    assert.equal((await (await fetch(base + '/api/health')).json()).version, '1.4.0');
  });
});
test('1.4 A: CHANGELOG starts with a 1.4.0 entry', async () => {
  const first = (await read('CHANGELOG.md')).split('\n').find((l) => l.startsWith('## '));
  assert.match(first, /^## 1\.4\.0/);
});

// ---------- B. sleep strip data ----------
const sleepDto = (overall) => ({
  dailySleepDTO: {
    sleepTimeSeconds: 27000, deepSleepSeconds: 5000, lightSleepSeconds: 15000, remSleepSeconds: 6000, awakeSleepSeconds: 1000,
    sleepStartTimestampGMT: Date.parse('2026-11-08T22:10:00Z'), sleepEndTimestampGMT: Date.parse('2026-11-09T05:40:00Z'),
    ...(overall === undefined ? {} : { sleepScores: { overall } }),
  },
});
// The nights path starts with the dailySleep path, so it must come first in the override map.
const sleepOver = (overall) => ({ '/sleep-service/sleep/dailySleepSummariesByDate': NIGHTS, '/sleep-service/sleep/dailySleep': sleepDto(overall) });
test('1.4 B: sleep.qualifier comes from Garmin, firstNight is false with 7 recorded nights', async () => {
  const s = (await build(sleepOver({ value: 82, qualifierKey: 'GOOD' }))).sleep;
  assert.equal(s.qualifier, 'GOOD');
  assert.equal(s.firstNight, false);
});
test('1.4 B: sleep.qualifier is derived from the score when Garmin sends none', async () => {
  assert.equal((await build(sleepOver({ value: 91 }))).sleep.qualifier, 'EXCELLENT');
  assert.equal((await build(sleepOver({ value: 80 }))).sleep.qualifier, 'GOOD');
  assert.equal((await build(sleepOver({ value: 65 }))).sleep.qualifier, 'FAIR');
  assert.equal((await build(sleepOver({ value: 40 }))).sleep.qualifier, 'POOR');
});
test('1.4 B: sleep.qualifier is null without a score', async () => {
  assert.equal((await build(sleepOver(undefined))).sleep.qualifier, null);
});
test('1.4 B: firstNight is true when today is the only recorded night of the last 7', async () => {
  const nights = NIGHTS.map((n) => (n.calendarDate === TODAY ? n : { ...n, sleepTimeSeconds: 0 }));
  const s = (await build({ ...sleepOver({ value: 82, qualifierKey: 'GOOD' }), '/sleep-service/sleep/dailySleepSummariesByDate': nights })).sleep;
  assert.equal(s.firstNight, true);
});

// ---------- C. last year ----------
const LAST_YEAR_OVER = actsOverride([...ACTS, ...ACTS_2025]);
test('1.4 C: lastYear compares this month and this year with 2025', async () => {
  const ly = (await build(LAST_YEAR_OVER)).lastYear;
  assert.equal(ly.year, 2025);
  assert.equal(ly.month.ym, '2025-11');
  assert.equal(ly.month.throughDay, 9);
  assert.equal(ly.month.available, true);
  // this Nov 1..9: Sun 4000 + 5 x 8000 + Sat 12000 + Sun 4000 + today 340; last Nov: 9 x 6000
  assert.deepEqual(ly.month.steps, { now: 60340, before: 54000, pct: 12 });
  assert.deepEqual(ly.month.workouts, { now: 3, before: 2, diff: 1 });
  assert.deepEqual(ly.month.trainingSeconds, { now: 9000, before: 6000, pct: 50 });
  assert.equal(ly.month.restingHrAvg.before, 54);
  assert.equal(typeof ly.month.restingHrAvg.diff, 'number');
  assert.equal(ly.toDate.available, true);
  assert.equal(ly.toDate.steps.before, 313 * 6000);
  assert.equal(ly.toDate.workouts.before, 3);
  assert.equal(ly.toDate.workouts.now, 7);
  assert.equal(ly.toDate.workouts.diff, 4);
  assert.equal(ly.months.length, 12);
  assert.equal(ly.months[0].ym, '2025-01');
  assert.equal(ly.months[11].ym, '2025-12');
  assert.ok(JSON.stringify(ly.months[0]).includes('186000'), 'January 2025 = 31 x 6000 steps');
});
test('1.4 C: lastYear says not available when 2025 has no data', async () => {
  const over = { '/usersummary-service/v2/dailysummaries': (path, query) => ({ data: longDays().filter((d) => d.calendarDate >= '2026-01-01' && d.calendarDate >= query.startDate && d.calendarDate <= query.endDate) }) };
  const ly = (await build(over)).lastYear;
  assert.equal(ly.year, 2025);
  assert.equal(ly.month.available, false);
  assert.equal(ly.toDate.available, false);
  assert.equal(ly.month.steps.pct, null);
  assert.equal(ly.toDate.steps.pct, null);
  assert.equal(ly.months.length, 12);
});
test('1.4 C: lastYear asks Garmin for 1 Jan to 9 Nov 2025', async () => {
  const client = makeClient();
  await buildBoard(client, { today: TODAY, now: () => NOW, storeDir: await tmp() });
  assert.ok(client.calls.some((c) => c.path.startsWith('/usersummary-service/v2/dailysummaries') && c.query.startDate === '2025-01-01' && c.query.endDate === '2025-11-09'), 'a 2025 daily-summary call');
  assert.ok(client.calls.some((c) => c.path.startsWith('/activitylist-service/activities/search/activities') && c.query.startDate === '2025-01-01' && c.query.endDate === '2025-11-09'), 'a 2025 activities call');
});

// ---------- D. weekly rhythm ----------
test('1.4 D: rhythm averages steps per weekday over 12 weeks, today excluded', async () => {
  const r = (await build()).rhythm;
  assert.equal(r.weeks, 12);
  assert.equal(r.since, '2026-08-17');
  assert.equal(r.until, '2026-11-08');
  assert.equal(r.days.length, 7);
  assert.deepEqual(r.days.map((d) => d.name), ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  assert.deepEqual(r.days.map((d) => d.dow), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(r.days.map((d) => d.avg), [8000, 8000, 8000, 8000, 8000, 12000, 4000]);
  assert.deepEqual(r.days.map((d) => d.count), Array(7).fill(12));
  assert.deepEqual(r.days.map((d) => d.goalDays), [0, 0, 0, 0, 0, 12, 0]);
  assert.equal(r.strongest, 'SAT');
  assert.equal(r.weakest, 'SUN');
  assert.equal(r.overallAvg, 8000);
});
test('1.4 D: rhythm has nulls when no day has data', async () => {
  const over = { '/usersummary-service/v2/dailysummaries': { data: [] } };
  const r = (await build(over)).rhythm;
  assert.equal(r.days.length, 7);
  assert.equal(r.strongest, null);
  assert.equal(r.weakest, null);
  assert.ok(r.days.every((d) => d.count === 0));
});

// ---------- E. weekly plan ----------
test('1.4 E: plan.items follow the settings and count this week\'s workouts', async () => {
  await withServer(makeClient(), async (base) => {
    const r = await put(base + '/api/settings', { plan: { runs: 2, strength: 2, swims: 1 } });
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).settings.plan, { runs: 2, strength: 2, swims: 1, rides: 0, hikes: 0, walks: 0, yoga: 0 });
    const p = (await (await fetch(base + '/api/board')).json()).plan;
    assert.deepEqual(p.items.map((i) => i.key), ['runs', 'strength', 'swims']);
    assert.deepEqual(p.items.map((i) => i.label), ['RUNS', 'STRENGTH', 'SWIMS']);
    assert.equal(p.weekStart, TODAY);
    assert.equal(p.daysLeft, 6);
    assert.equal(p.target, 5);
    assert.equal(p.items[0].done, 1);
    assert.deepEqual(p.items[0].dates, [TODAY]);
    assert.equal(p.items[1].done, 0);
    assert.equal(p.items[2].done, 0);
    assert.equal(p.done, 1);
    assert.equal(p.complete, false);
  });
});
test('1.4 E: plan is empty without targets', async () => {
  const p = (await build()).plan;
  assert.deepEqual(p.items, []);
  assert.equal(p.target, 0);
  assert.equal(p.complete, false);
});
test('1.4 E: plan counts a swim and a walk that fall in the week', async () => {
  const list = [...ACTS, act(401, '2026-11-09 06:00:00', 'open_water_swimming', 10), act(402, '2026-11-09 18:00:00', 'walking', 5)];
  await withServer(makeClient(actsOverride(list)), async (base) => {
    await put(base + '/api/settings', { plan: { runs: 1, swims: 1, walks: 1 } });
    const p = (await (await fetch(base + '/api/board')).json()).plan;
    assert.deepEqual(p.items.map((i) => [i.key, i.done]), [['runs', 1], ['swims', 1], ['walks', 1]]);
    assert.equal(p.complete, true);
    assert.equal(p.done, 3);
  });
});
test('1.4 E: a negative plan number is rejected with 400', async () => {
  await withServer(makeClient(), async (base) => {
    assert.equal((await put(base + '/api/settings', { plan: { runs: -1 } })).status, 400);
  });
});

// ---------- F. resting pulse trend ----------
test('1.4 F: restingTrend has 90 days, no today, and a 7-day trailing mean', async () => {
  const t = (await build()).restingTrend;
  assert.equal(t.days, 90);
  assert.equal(t.since, dateAdd(TODAY, -89));
  assert.ok(t.points.every((p) => p.date >= t.since && p.date < TODAY), 'today excluded');
  assert.ok(!t.points.some((p) => p.date === GAP), 'a day without a pulse is skipped');
  assert.equal(t.points.length, 88);
  assert.deepEqual(t.points[t.points.length - 1], { date: '2026-11-08', bpm: restingOf('2026-11-08') });
  const last7 = t.points.slice(-7).map((p) => p.bpm);
  const mean = Math.round((last7.reduce((a, b) => a + b, 0) / 7) * 10) / 10;
  assert.equal(t.avg7[t.avg7.length - 1].bpm, mean);
  assert.equal(t.avg7[t.avg7.length - 1].date, '2026-11-08');
  const all = t.points.map((p) => p.bpm);
  assert.equal(t.min, Math.min(...all));
  assert.equal(t.max, Math.max(...all));
  assert.ok(Math.abs(t.avg - all.reduce((a, b) => a + b, 0) / all.length) <= 0.5);
  assert.deepEqual(t.latest, { date: '2026-11-08', bpm: restingOf('2026-11-08') });
});
test('1.4 F: restingTrend is empty without data', async () => {
  const t = (await build({ '/usersummary-service/v2/dailysummaries': { data: [] } })).restingTrend;
  assert.deepEqual(t.points, []);
  assert.equal(t.latest, null);
});

// ---------- G. hydration ----------
test('1.4 G: hydration from a logged week', async () => {
  const rows = [
    { calendarDate: '2026-11-07', valueInML: 1800, goalInML: 2500 },
    { calendarDate: '2026-11-08', valueInML: 2400, goalInML: 2500 },
    { calendarDate: '2026-11-09', valueInML: 1200, goalInML: 2500 },
  ];
  const h = (await build({ '/usersummary-service/stats/hydration/daily/': rows })).hydration;
  assert.equal(h.logged, true);
  assert.equal(h.todayMl, 1200);
  assert.equal(h.goalMl, 2500);
  assert.equal(h.pct, 48);
  assert.equal(h.days.length, 7);
  assert.equal(h.days[6].date, TODAY);
  assert.equal(h.days[6].ml, 1200);
  assert.equal(h.days[0].date, '2026-11-03');
  assert.equal(h.days[0].ml, 0);
  assert.equal(h.avgMl, 1800);
});
test('1.4 G: hydration with nothing logged', async () => {
  const h = (await build({
    '/usersummary-service/stats/hydration/daily/': [],
    '/usersummary-service/usersummary/daily': { lastSyncTimestampGMT: '2026-11-09T06:02:15.751', hydrationGoalInML: 2500 },
  })).hydration;
  assert.equal(h.logged, false);
  assert.equal(h.goalMl, 2500);
  assert.equal(h.pct, null);
  assert.equal(h.avgMl, null);
  assert.equal(h.lastEntryAt, null);
  assert.equal(h.days.length, 7);
  assert.ok(h.days.every((d) => d.ml === 0));
});
test('1.4 G: the hydration call covers the last 7 days', async () => {
  const client = makeClient();
  await buildBoard(client, { today: TODAY, now: () => NOW, storeDir: await tmp() });
  assert.ok(client.calls.some((c) => c.path === `/usersummary-service/stats/hydration/daily/2026-11-03/${TODAY}`), 'hydration path');
});

// ---------- H. stress ----------
const stressToday = (o = {}) => ({
  '/usersummary-service/usersummary/daily': {
    lastSyncTimestampGMT: '2026-11-09T06:02:15.751', averageStressLevel: 23, maxStressLevel: 90,
    restStressDuration: 23580, lowStressDuration: 10200, mediumStressDuration: 960, highStressDuration: 420,
    stressQualifier: 'CALM_AWAKE', hydrationGoalInML: 2500, ...o,
  },
});
test('1.4 H: stress.today reads usersummary/daily', async () => {
  const s = (await build(stressToday())).stress;
  assert.deepEqual(s.today, { avg: 23, max: 90, qualifier: 'CALM', restSec: 23580, lowSec: 10200, mediumSec: 960, highSec: 420, measuredSec: 35160 });
});
test('1.4 H: stress qualifier mapping', async () => {
  const cases = { CALM: 'CALM', CALM_AWAKE: 'CALM', BALANCED: 'BALANCED', BALANCED_AWAKE: 'BALANCED', STRESSFUL: 'STRESSFUL', STRESSFUL_AWAKE: 'STRESSFUL', VERY_STRESSFUL: 'VERY STRESSFUL', VERY_STRESSFUL_AWAKE: 'VERY STRESSFUL', SOMETHING_ELSE: null };
  for (const [from, to] of Object.entries(cases)) {
    assert.equal((await build(stressToday({ stressQualifier: from }))).stress.today.qualifier, to, from);
  }
});
test('1.4 H: stress -1 means no value', async () => {
  const s = (await build(stressToday({ averageStressLevel: -1 }))).stress;
  assert.equal(s.today.avg, null);
});
test('1.4 H: stress.days has 28 days ending today and avg28 excludes today', async () => {
  const s = (await build(stressToday())).stress;
  assert.equal(s.days.length, 28);
  assert.equal(s.days[27].date, TODAY);
  assert.equal(s.days[0].date, dateAdd(TODAY, -27));
  assert.equal(s.days[26].avg, stressOf('2026-11-08'));
  const prev = Array.from({ length: 27 }, (_, i) => stressOf(dateAdd(TODAY, -27 + i)));
  assert.ok(Math.abs(s.avg28 - prev.reduce((a, b) => a + b, 0) / 27) <= 0.5);
});

// ---------- I. notification ----------
test('1.4 I: notify is called once for a new red alert, not again on refresh', async () => {
  const calls = [];
  await withServer(makeClient({}, {}, { todayResting: 70 }), async (base) => {
    assert.equal((await fetch(base + '/api/board')).status, 200);
    await sleep(150);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].title.includes('Red alert'));
    assert.ok(calls[0].text.includes('RESTING PULSE'));
    assert.ok(calls[0].alerts.some((a) => a.key === 'resting-hr'));
    await fetch(base + '/api/board?refresh=1');
    await sleep(150);
    assert.equal(calls.length, 1);
  }, { notify: (n) => { calls.push(n); } });
});
test('1.4 I: no alert, no notification', async () => {
  const calls = [];
  await withServer(makeClient(), async (base) => {
    await fetch(base + '/api/board');
    await sleep(150);
    assert.equal(calls.length, 0);
  }, { notify: (n) => { calls.push(n); } });
});
test('1.4 I: notify:false in settings switches it off, and GET returns it', async () => {
  const calls = [];
  await withServer(makeClient({}, {}, { todayResting: 70 }), async (base) => {
    assert.equal((await (await fetch(base + '/api/settings')).json()).settings.notify, true);
    const r = await put(base + '/api/settings', { notify: false });
    assert.equal((await r.json()).settings.notify, false);
    await fetch(base + '/api/board');
    await sleep(150);
    assert.equal(calls.length, 0);
  }, { notify: (n) => { calls.push(n); } });
});

// ---------- J. access code ----------
test('1.4 J: the access code is shown on the Mac, never to the home network', async () => {
  const remote = (req) => (req.headers['x-test-remote'] ? '192.168.1.20' : '127.0.0.1');
  await withServer(makeClient(), async (base) => {
    await put(base + '/api/settings', { accessCode: 'abc123' });
    const local = (await (await fetch(base + '/api/settings')).json()).settings;
    assert.equal(local.accessCode, 'abc123');
    assert.equal(local.hasAccessCode, true);
    const lan = await fetch(base + '/api/settings', { headers: { 'x-test-remote': '1', cookie: 'ams-board-code=abc123' } });
    assert.equal(lan.status, 200);
    const j = (await lan.json()).settings;
    assert.equal(j.accessCode, undefined);
    assert.equal(j.hasAccessCode, true);
  }, { remoteAddressOf: remote });
});

// ---------- K. the page ----------
const NEW_IDS = [
  'sleep-strip', 'last-year-line', ...Array.from({ length: 12 }, (_, i) => `year-last-${String(i + 1).padStart(2, '0')}`),
  'rhythm-panel', 'explain-rhythm', 'rhythm-chart', 'rhythm-note',
  'plan-panel', 'explain-plan', 'plan-edit-button', 'plan-list', 'plan-note',
  'resting-trend-panel', 'explain-resting-trend', 'resting-trend-chart', 'resting-trend-note',
  'hydration-panel', 'explain-hydration', 'hydration-gauge', 'hydration-days', 'hydration-note',
  'stress-panel', 'explain-stress', 'stress-word', 'stress-stack', 'stress-days-chart', 'stress-note',
  'share-button', 'share-sheet', 'share-canvas', 'share-save', 'share-send', 'share-close',
  'notify-toggle', 'plan-runs', 'plan-strength', 'plan-swims', 'plan-rides', 'plan-hikes', 'plan-walks', 'plan-yoga', 'access-code-current',
];
test('1.4 K: index.html carries every new element id', async () => {
  const html = await read('board', 'public', 'index.html');
  assert.deepEqual(NEW_IDS.filter((id) => !html.includes(`id="${id}"`)), []);
});
test('1.4 K: the footer shows 1.4.0 and the page has exactly 30 explain buttons', async () => {
  const html = await read('board', 'public', 'index.html');
  assert.match(html, /id="footer-version"[^>]*>[^<]*1\.4\.0/);
  const buttons = [...html.matchAll(/id="explain-[a-z-]+"/g)].filter((m) => !/explain-(sheet|title|summary|more|close)"/.test(m[0]));
  assert.equal(buttons.length, 30);
});
test('1.4 K: the new panels come after the log and before the month navigation', async () => {
  const html = await read('board', 'public', 'index.html');
  const at = (id) => html.indexOf(`id="${id}"`);
  const order = ['log-panel', 'plan-panel', 'rhythm-panel', 'resting-trend-panel', 'stress-panel', 'hydration-panel', 'month-nav'].map(at);
  assert.ok(order.every((n) => n >= 0), 'all present');
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});
test('1.4 K: board.js draws the new parts', async () => {
  const js = await read('board', 'public', 'board.js');
  for (const s of ['share-canvas', 'toBlob', 'rhythm-chart', 'resting-trend-chart', 'stress-days-chart', 'hydration-gauge', 'plan-list', 'sleep-strip', 'last-year-line']) assert.ok(js.includes(s), s);
});
test('1.4 K: board.css has a print block', async () => {
  assert.ok((await read('board', 'public', 'board.css')).includes('@media print'));
});
test('1.4 K: explain.js has the five new keys', async () => {
  delete globalThis.AMS_EXPLAIN;
  await import(pathToFileURL(join(PUB, 'explain.js')).href + '?v14');
  for (const k of ['rhythm', 'plan', 'resting-trend', 'hydration', 'stress']) {
    const e = globalThis.AMS_EXPLAIN[k];
    assert.ok(e && e.title && e.summary && Array.isArray(e.more) && e.more.length >= 3, k);
  }
});
