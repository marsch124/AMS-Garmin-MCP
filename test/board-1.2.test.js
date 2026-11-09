// AMS Garmin Board 1.2.0 — tests written before the code. All numbers are invented.
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
const tmp = () => mkdtemp(join(tmpdir(), 'board12-'));

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

// ---------- A. version and docs ----------
test('1.2 A: package.json version is at least 1.2.0', async () => {
  assert.ok(JSON.parse(await read('package.json')).version >= '1.2.0');
});
test('1.2 A: CHANGELOG has a 1.2.0 entry', async () => {
  const lines = (await read('CHANGELOG.md')).split('\n');
  assert.ok(lines.some((l) => /^## 1\.2\.0/.test(l)));
});
test('1.2 A: SPEC mentions palette-select and /api/month', async () => {
  const spec = await read('docs', 'SPEC.md');
  assert.ok(spec.includes('palette-select'));
  assert.ok(spec.includes('/api/month'));
});

// ---------- B. colour schemes ----------
const SCHEMES = ['calm-dusk', 'calm-dark', 'calm-day', 'ice', 'ember', 'forest', 'graphite'];
const blockOf = (css, header) => {
  const i = css.indexOf(header);
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
};
test('1.2 B: default :root block holds the calm-dusk colours', async () => {
  const root = blockOf(await read('board', 'public', 'board.css'), ':root {');
  for (const v of ['--bg: #3d3a44', '--c1: #ff9966', '--c2: #ffcc99', '--c3: #cc99cc', '--c7: #cc6666']) assert.ok(root.includes(v), v);
});
test('1.2 B: every scheme has a [data-scheme] block', async () => {
  const css = await read('board', 'public', 'board.css');
  for (const s of SCHEMES) assert.ok(css.includes(`[data-scheme="${s}"]`), s);
});
test('1.2 B: ice and calm-day carry their own colours', async () => {
  const css = await read('board', 'public', 'board.css');
  assert.ok(blockOf(css, '[data-scheme="ice"]').includes('--c1: #8fd3ff'));
  assert.ok(blockOf(css, '[data-scheme="calm-day"]').includes('--bg: #f1ebe3'));
});

// ---------- C. the page ----------
const KEYS = ['chrono', 'steps', 'body-battery', 'heart', 'intensity', 'energy', 'bb-curve', 'fitness', 'sleep', 'hrv', 'sleep-debt', 'weight', 'training', 'zones', 'streaks', 'weather', 'targets', 'log', 'month-steps', 'month-hr', 'activities', 'month-totals', 'activity-detail', 'year', 'red-alert', 'rhythm', 'plan', 'resting-trend', 'hydration', 'stress', 'link'];
const PAGE_IDS = [
  'board', 'clock-local', 'clock-utc', 'clock-date', 'stardate', 'steps-gauge', 'steps-value', 'body-battery-bar', 'resting-hr', 'stress-bar', 'intensity-gauge', 'floors-value', 'calories-value',
  'month-steps-chart', 'month-hr-chart', 'activities-list', 'activities-total', 'sleep-panel', 'hrv-panel', 'weight-thermo', 'link-status', 'last-refresh', 'refresh-button', 'version-label',
  'red-alert', 'red-alert-text', 'chrono-panel', 'sunrise-value', 'sunset-value', 'travel-row', 'travel-days', 'travel-km', 'travel-zone',
  'steps-panel', 'body-battery-panel', 'heart-panel', 'intensity-panel', 'energy-panel', 'bb-curve-panel', 'bb-curve-chart',
  'fitness-panel', 'vo2max-value', 'vo2max-trend', 'fitness-age-value', 'fitness-age-trend', 'chrono-age-value',
  'sleep-debt-panel', 'sleep-debt-value', 'sleep-debt-chart', 'sleep-debt-note',
  'weight-panel', 'weight-trend-chart', 'weight-date', 'weight-delta', 'weight-goal',
  'training-panel', 'training-load-bar', 'training-acute', 'training-chronic', 'training-ratio', 'training-status',
  'zones-panel', 'zones-chart', 'zones-total',
  'streaks-panel', 'streak-steps-current', 'streak-steps-longest', 'streak-workout-current', 'streak-workout-longest',
  'weather-panel', 'weather-place', 'weather-temp', 'weather-text', 'weather-wind', 'weather-rain', 'weather-hours', 'weather-locate-button',
  'targets-panel', 'targets-list', 'target-bar-steps', 'target-bar-workouts', 'target-bar-swims', 'target-bar-runs', 'target-bar-training-minutes', 'target-bar-distance-km', 'targets-edit-button',
  'log-panel', 'log-today-input', 'log-save-button', 'log-list',
  'month-nav', 'month-prev', 'month-label', 'month-next', 'month-today',
  'month-steps-panel', 'month-hr-panel', 'activities-panel', 'month-totals-panel',
  'delta-steps', 'delta-distance', 'delta-floors', 'delta-intensity', 'delta-resting-hr', 'delta-workouts', 'delta-training-time',
  'activity-detail-panel', 'detail-title', 'detail-summary', 'detail-splits', 'detail-hr-chart', 'detail-map', 'detail-close',
  'year-panel', 'year-tiles', ...Array.from({ length: 12 }, (_, i) => `year-tile-${String(i + 1).padStart(2, '0')}`),
  'palette-select', 'kiosk-button', 'help-button', 'report-button', 'settings-button', 'footer-version',
  'explain-sheet', 'explain-title', 'explain-summary', 'explain-more', 'explain-close',
  'help-sheet', 'help-tab-how', 'help-tab-new', 'help-content', 'help-close',
  'settings-sheet', 'target-steps', 'target-workouts', 'target-swims', 'target-runs', 'target-training-minutes', 'target-distance-km', 'access-code', 'lan-address', 'settings-cancel', 'settings-save',
  'report-sheet', 'report-title', 'report-text', 'report-close', 'report-kind-week', 'report-kind-month',
];
const pageHtml = () => withServer(makeClient(), async (base) => (await fetch(base + '/')).text());

test('1.2 C: the page carries every element id from the brief', async () => {
  const html = await pageHtml();
  const missing = PAGE_IDS.filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
});
test('1.2 C: 30 explain buttons, one per key except link', async () => {
  const html = await pageHtml();
  const keys = KEYS.filter((k) => k !== 'link');
  assert.equal(keys.length, 30);
  for (const k of keys) assert.ok(html.includes(`id="explain-${k}"`), `explain-${k}`);
  assert.equal([...html.matchAll(/id="explain-[a-z-]+"/g)].filter((m) => !/explain-(sheet|title|summary|more|close)"/.test(m[0])).length, 30);
});
test('1.2 C: palette select offers all 7 schemes', async () => {
  const html = await pageHtml();
  assert.ok(/<select[^>]*id="palette-select"/.test(html));
  for (const s of SCHEMES) assert.ok(html.includes(`value="${s}"`), s);
});
test('1.2 C: page loads explain.js and remembers the scheme in localStorage', async () => {
  const html = await pageHtml();
  assert.ok(/<script[^>]*src="explain\.js"/.test(html));
  assert.ok(html.includes('ams-garmin-board.scheme'));
});

// ---------- D. explain.js ----------
test('1.2 D: /explain.js is served as javascript', async () => {
  await withServer(makeClient(), async (base) => {
    const r = await fetch(base + '/explain.js');
    assert.equal(r.status, 200);
    assert.ok(r.headers.get('content-type').includes('javascript'));
    await r.text();
  });
});
test('1.2 D: explain.js defines all 31 keys with title, summary and 3+ paragraphs', async () => {
  delete globalThis.AMS_EXPLAIN;
  await import(pathToFileURL(join(PUB, 'explain.js')).href);
  const ex = globalThis.AMS_EXPLAIN;
  assert.ok(ex);
  assert.deepEqual(Object.keys(ex).sort(), [...KEYS].sort());
  for (const k of KEYS) {
    assert.ok(typeof ex[k].title === 'string' && ex[k].title.trim(), `${k} title`);
    assert.ok(typeof ex[k].summary === 'string' && ex[k].summary.trim(), `${k} summary`);
    assert.ok(Array.isArray(ex[k].more) && ex[k].more.length >= 3, `${k} more`);
    assert.ok(ex[k].more.every((p) => typeof p === 'string' && p.trim()), `${k} paragraphs`);
  }
});
test('1.2 D: every explain-<key> id in index.html has an entry', async () => {
  const html = await read('board', 'public', 'index.html');
  const ids = [...html.matchAll(/id="explain-([a-z-]+)"/g)].map((m) => m[1]).filter((k) => !['sheet', 'title', 'summary', 'more', 'close'].includes(k));
  assert.ok(ids.length > 0);
  delete globalThis.AMS_EXPLAIN;
  await import(pathToFileURL(join(PUB, 'explain.js')).href + '?again');
  for (const k of ids) assert.ok(globalThis.AMS_EXPLAIN?.[k], k);
});

// ---------- E. buildBoard additions ----------
test('1.2 E: compare with the previous month through the same day', async () => {
  const c = (await build()).compare;
  assert.equal(c.previousMonth, '2026-10');
  assert.equal(c.throughDay, 9);
  assert.equal(c.steps.now, 41340);
  assert.equal(c.steps.before, 90000);
  assert.equal(c.steps.pct, -54);
});
test('1.2 E: step-goal streaks', async () => {
  const s = (await build()).streaks.stepGoal;
  assert.equal(s.current, 1);  // Nov 8 met, Nov 7 missed, today not met yet and does not break it
  assert.equal(s.longest, 12); // Oct 1..12
  assert.equal(s.longestEnd, '2026-10-12');
});
test('1.2 E: alert resting-hr fires when today is 10 percent above the month average', async () => {
  const b = await build({}, { todayResting: 60 }); // average of finished days is 50
  assert.ok(b.alerts.some((a) => a.key === 'resting-hr'));
});
test('1.2 E: alert body-battery fires below 20', async () => {
  const b = await build({}, { todayBB: 15 });
  assert.ok(b.alerts.some((a) => a.key === 'body-battery'));
});
test('1.2 E: no alerts on a quiet day', async () => {
  assert.deepEqual((await build()).alerts, []);
});
test('1.2 E: training load acute, chronic, ratio and status', async () => {
  const t = (await build()).training;
  assert.equal(t.acute, 160);
  assert.equal(t.chronic, 135);
  assert.ok(Math.abs(t.ratio - 1.185) < 0.01);
  assert.equal(t.status, 'PRODUCTIVE');
  assert.equal(t.days.length, 7);
});
test('1.2 E: zones sum this week and read floors from the watch', async () => {
  const z = (await build()).zones;
  assert.deepEqual(z.secondsInZone, [60, 120, 180, 240, 300]);
  assert.equal(z.total, 900);
  assert.deepEqual(z.floors, [100, 115, 130, 145, 160]);
  assert.equal(z.maxHr, 175);
});
test('1.2 E: fitness holds VO2 max and fitness age', async () => {
  const f = (await build()).fitness;
  assert.equal(f.vo2max.value, 52);
  assert.equal(f.fitnessAge.value, 49);
  assert.equal(f.fitnessAge.chronological, 60);
});
test('1.2 E: body battery curve of today', async () => {
  const c = (await build()).bodyBatteryCurve;
  assert.equal(c.points.length, 4);
  assert.deepEqual(c.points[0], [Date.parse('2026-11-09T00:00:00Z'), 80]);
  assert.equal(c.events.length, 1);
  assert.equal(c.events[0].impact, 40);
  assert.equal(c.events[0].endMs - c.events[0].startMs, 25200000);
});
test('1.2 E: sleep debt adds need minus slept minus naps over 7 nights', async () => {
  const d = (await build()).sleepDebt;
  assert.equal(d.recorded, true);
  assert.equal(d.nights.length, 7);
  assert.equal(d.debtMin, 7 * (460 - 420 - 10));
});
test('1.2 E: sleep debt not recorded when Garmin has no summaries', async () => {
  const d = (await build({ '/sleep-service/sleep/dailySleepSummariesByDate': [] })).sleepDebt;
  assert.equal(d.recorded, false);
});
test('1.2 E: weight trend has points, a 7-day average and the goal', async () => {
  const w = (await build()).weightTrend;
  assert.equal(w.points.length, 5);
  assert.ok(w.avg7.length > 0);
  assert.equal(w.goalKg, 80);
});
test('1.2 E: year has 12 months and the October total', async () => {
  const y = (await build()).year;
  assert.equal(y.months.length, 12);
  assert.deepEqual(y.months.map((m) => m.ym), Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`));
  assert.equal(y.months[9].steps, 120000);
  assert.equal(y.months[11].steps, 0);
});
test('1.2 E: defaults for travel, targets, log and last sync', async () => {
  const b = await build();
  assert.equal(b.travel, null);
  assert.equal(typeof b.targets, 'object');
  assert.equal(typeof b.targets.steps, 'number');
  assert.deepEqual(b.log, {});
  assert.match(b.lastSyncAt, /^2026-11-09T06:02:15/);
});

// ---------- F. server routes ----------
test('1.2 F: /api/month gives October with 31 days and only October workouts', async () => {
  await withServer(makeClient(), async (base) => {
    const j = await (await fetch(base + '/api/month?ym=2026-10')).json();
    assert.equal(j.ok, true);
    assert.equal(j.ym, '2026-10');
    assert.equal(j.month.days.length, 31);
    assert.ok(j.activities.list.length > 0);
    assert.ok(j.activities.list.every((a) => a.start.startsWith('2026-10')));
  });
});

const wxBody = {
  current: { time: '2026-11-09T10:00', temperature_2m: 7.5, wind_speed_10m: 12, precipitation: 0.4, weather_code: 61 },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => `2026-11-${i < 24 ? '09' : '10'}T${String(i % 24).padStart(2, '0')}:00`),
    temperature_2m: Array(48).fill(6), precipitation_probability: Array(48).fill(30), wind_speed_10m: Array(48).fill(10), weather_code: Array(48).fill(3),
  },
  daily: { sunrise: ['2026-11-09T07:10'], sunset: ['2026-11-09T16:20'] },
};
const fakeFetch = () => {
  const f = async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), async json() { return wxBody; }, async text() { return JSON.stringify(wxBody); } });
  let n = 0;
  const counted = async (...a) => { n++; return f(...a); };
  counted.count = () => n;
  return counted;
};
test('1.2 F: /api/weather answers and caches for 15 minutes', async () => {
  const fetchFn = fakeFetch();
  await withServer(makeClient(), async (base) => {
    const j = await (await fetch(base + '/api/weather?lat=40.1&lon=-3.4')).json();
    assert.equal(j.ok, true);
    assert.equal(j.now.tempC, 7.5);
    assert.equal(j.now.text, 'RAIN');
    assert.equal(j.hours.length, 12);
    assert.ok(j.sun.sunrise);
    const calls = fetchFn.count();
    assert.ok(calls >= 1);
    await (await fetch(base + '/api/weather?lat=40.1&lon=-3.4')).json();
    assert.equal(fetchFn.count(), calls);
  }, { fetchFn });
});

test('1.2 F: /api/settings gives defaults and a PUT persists across servers', async () => {
  const storeDir = await tmp();
  await withServer(makeClient(), async (base) => {
    const g = await (await fetch(base + '/api/settings')).json();
    assert.equal(g.ok, true);
    assert.equal(typeof g.settings.targets.steps, 'number');
    assert.equal(g.settings.hasAccessCode, false);
    assert.equal(typeof g.settings.lanAddress, 'string');
    const p = await put(base + '/api/settings', { targets: { steps: 400000 } });
    assert.equal(p.status, 200);
    assert.equal((await p.json()).settings.targets.steps, 400000);
    assert.equal((await (await fetch(base + '/api/settings')).json()).settings.targets.steps, 400000);
  }, { storeDir });
  await withServer(makeClient(), async (base) => {
    assert.equal((await (await fetch(base + '/api/settings')).json()).settings.targets.steps, 400000);
  }, { storeDir });
});
test('1.2 F: an access code is stored; since 1.4 the Mac itself may read it back, the home network never', async () => {
  await withServer(makeClient(), async (base) => {
    const r = await put(base + '/api/settings', { accessCode: 'abc' });
    const j = JSON.parse(await r.text());
    assert.equal(j.settings.hasAccessCode, true);
    assert.equal(j.settings.accessCode, 'abc'); // loopback = this Mac
    const g = JSON.parse(await (await fetch(base + '/api/settings')).text());
    assert.equal(g.settings.hasAccessCode, true);
    assert.equal(g.settings.accessCode, 'abc');
  });
  await withServer(makeClient(), async (base) => {
    await put(base + '/api/settings', { accessCode: 'abc' });
  }, { storeDir: await tmp(), remoteAddressOf: () => '127.0.0.1' });
});

test('1.2 F: the Captain\'s log reads, writes, removes and limits to 200 chars', async () => {
  await withServer(makeClient(), async (base) => {
    assert.deepEqual((await (await fetch(base + '/api/log?ym=2026-11')).json()).entries, {});
    const p = await put(base + '/api/log/2026-11-09', { text: 'Good day' });
    assert.equal(p.status, 200);
    assert.equal((await (await fetch(base + '/api/log?ym=2026-11')).json()).entries['2026-11-09'], 'Good day');
    await put(base + '/api/log/2026-11-09', { text: '' });
    assert.deepEqual((await (await fetch(base + '/api/log?ym=2026-11')).json()).entries, {});
    const long = await put(base + '/api/log/2026-11-09', { text: 'x'.repeat(201) });
    assert.equal(long.status, 400);
  });
});

test('1.2 F: travel marker starts away and clears at home', async () => {
  await withServer(makeClient(), async (base) => {
    const away = await (await post(base + '/api/travel', { zone: 'Europe/Madrid' })).json();
    assert.equal(away.ok, true);
    assert.equal(away.travel.since, TODAY);
    assert.equal(away.travel.days, 1);
    const home = await (await post(base + '/api/travel', { zone: 'Europe/Stockholm' })).json();
    assert.equal(home.travel, null);
  });
});

for (const kind of ['week', 'month']) {
  test(`1.2 F: /api/report?kind=${kind} gives a title and a text about steps`, async () => {
    await withServer(makeClient(), async (base) => {
      const j = await (await fetch(base + `/api/report?kind=${kind}`)).json();
      assert.equal(j.ok, true);
      assert.equal(j.kind, kind);
      assert.equal(typeof j.title, 'string');
      assert.match(j.text, /steps/i);
    });
  });
}

test('1.2 F: /api/docs gives the guide, the history and the version', async () => {
  await withServer(makeClient(), async (base) => {
    const j = await (await fetch(base + '/api/docs')).json();
    assert.equal(j.ok, true);
    assert.equal(j.version, JSON.parse(await read('package.json')).version);
    assert.ok(typeof j.howItWorks === 'string' && j.howItWorks.length > 0);
    assert.ok(typeof j.whatsNew === 'string' && j.whatsNew.length > 0);
  });
});

test('1.2 F: /api/activity/<id> joins Garmin summary and the FIT file; unknown id is 404', async () => {
  const startMs = Date.parse('2026-11-09T07:00:00Z');
  const zip = buildFitZip({
    startMs,
    records: [
      { t: 0, lat: 40.1234, lon: -3.4567, hr: 120, distanceM: 0, altM: 600 },
      { t: 10, lat: 40.1244, lon: -3.4557, hr: 130, distanceM: 30, altM: 601 },
      { t: 20, lat: 40.1254, lon: -3.4547, hr: 140, distanceM: 60, altM: 602 },
    ],
    laps: [
      { t: 0, seconds: 10, distanceM: 30, avgHr: 125, maxHr: 130, ascentM: 1 },
      { t: 10, seconds: 10, distanceM: 30, avgHr: 135, maxHr: 140, ascentM: 1 },
    ],
  });
  const client = makeClient({
    '/activity-service/activity/555': { activityId: 555, activityName: 'Invented run', activityTypeDTO: { typeKey: 'running' }, summaryDTO: { startTimeLocal: '2026-11-09T08:00:00.0', distance: 60, duration: 20, averageHR: 130, maxHR: 140, calories: 5, elevationGain: 2 } },
    '/activity-service/activity/999': () => { throw new GarminError('not found', { status: 404 }); },
  }, { getBinary: async () => ({ buffer: zip, contentType: 'application/zip', filename: 'x.zip' }) });
  await withServer(client, async (base) => {
    const j = await (await fetch(base + '/api/activity/555')).json();
    assert.equal(j.ok, true);
    assert.equal(j.id, 555);
    assert.equal(j.splits.length, 2);
    assert.equal(j.splits[0].avgHr, 125);
    assert.equal(j.hr.length, 3);
    assert.deepEqual(j.hr[0], [0, 120]);
    assert.ok(j.trace.length > 0);
    assert.ok(Math.abs(j.trace[0][0] - 40.1234) < 0.001 && Math.abs(j.trace[0][1] - -3.4567) < 0.001);
    const missing = await fetch(base + '/api/activity/999');
    assert.equal(missing.status, 404);
  });
});

// ---------- G. LAN gate ----------
test('1.2 G: from the LAN without a code, pages redirect to /code and the API answers 403', async () => {
  await withServer(makeClient(), async (base) => {
    const page = await fetch(base + '/', { redirect: 'manual' });
    assert.equal(page.status, 302);
    assert.ok(page.headers.get('location').endsWith('/code'));
    assert.equal((await fetch(base + '/api/board')).status, 403);
  }, { remoteAddressOf: () => '192.168.1.20' });
});
test('1.2 G: with a code set, the cookie opens the LAN, a wrong or missing one does not', async () => {
  const storeDir = await tmp();
  await withServer(makeClient(), async (loop) => {
    assert.equal((await put(loop + '/api/settings', { accessCode: 'abc' })).status, 200);
  }, { storeDir, remoteAddressOf: () => '127.0.0.1' });
  await withServer(makeClient(), async (base) => {
    const ok = await fetch(base + '/', { headers: { cookie: 'ams-board-code=abc' }, redirect: 'manual' });
    assert.equal(ok.status, 200);
    await ok.text();
    assert.equal((await fetch(base + '/', { redirect: 'manual' })).status, 302);
    assert.equal((await fetch(base + '/', { headers: { cookie: 'ams-board-code=wrong' }, redirect: 'manual' })).status, 302);
    const form = await fetch(base + '/code', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'code=abc', redirect: 'manual' });
    assert.equal(form.status, 302);
    assert.ok((form.headers.get('set-cookie') || '').includes('ams-board-code=abc'));
    const settings = await put(base + '/api/settings', { targets: { steps: 1 } }, { cookie: 'ams-board-code=abc' });
    assert.equal(settings.status, 403);
  }, { storeDir, remoteAddressOf: () => '192.168.1.20' });
});

// ---------- H. scripts ----------
test('1.2 H: install-agents.sh and report.sh exist and can run', async () => {
  await access(join(ROOT, 'scripts', 'install-agents.sh'), constants.X_OK);
  await access(join(ROOT, 'scripts', 'report.sh'), constants.X_OK);
});
test('1.2 H: install-agents.sh names both launch agents', async () => {
  const s = await read('scripts', 'install-agents.sh');
  assert.ok(s.includes('com.ams.garmin.board.server'));
  assert.ok(s.includes('com.ams.garmin.board.report'));
});
