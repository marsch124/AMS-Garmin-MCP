import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, monthStart, weekStart } from '../board/board-data.js';
import { createBoardServer } from '../board/server.js';
import { fakeClient } from './helpers.js';

const TODAY = '2026-11-09';
const NOW = Date.parse('2026-11-09T09:00:00Z');

const day = (date, o = {}) => ({
  calendarDate: date,
  movement: { steps: { goal: 11500, value: 12480, distanceInMeters: 9100 }, floorsAscended: { goal: 10, value: 148 } },
  calories: { burnedResting: 2045, burnedActive: 804, burnedTotal: 2849 },
  heartRate: { minValue: 45, maxValue: 144, restingValue: 51 },
  intensityMinutes: { goal: 600, moderate: 75, vigorous: 21 },
  stress: { avgLevel: 18, maxLevel: 76 },
  bodyBattery: { minValue: 46, maxValue: 76, chargedValue: 6, drainedValue: 36, latestValue: 46 },
  respiration: { avgValue: 12 },
  ...o,
});
const DAYS = [
  day('2026-11-07'),
  day('2026-11-08', {
    movement: { steps: { goal: 11000, value: 9876, distanceInMeters: 9000 }, floorsAscended: { goal: 10, value: 80 } },
    heartRate: { minValue: 47, maxValue: 130, restingValue: 55 },
    intensityMinutes: { goal: 600, moderate: 30, vigorous: 0 },
  }),
  day('2026-11-09', {
    movement: { steps: { goal: 12000, value: 340, distanceInMeters: 250 }, floorsAscended: { goal: 10, value: 2 } },
    heartRate: { minValue: 60, maxValue: 90, restingValue: 73 },
    intensityMinutes: { goal: 600, moderate: 5, vigorous: 1 },
    stress: { avgLevel: -1, maxLevel: -1 },
    bodyBattery: { minValue: 60, maxValue: 88, chargedValue: 30, drainedValue: 5, latestValue: 83 },
  }),
];
const ACTIVITIES = [
  { activityId: 2, activityName: 'Morning Run', activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-06 07:00:00', duration: 1883.2, distance: 2717.7, calories: 193, averageHR: 140, maxHR: 160, elevationGain: 37 },
  { activityId: 1, activityName: 'Hilltop Hiking', activityType: { typeKey: 'hiking' }, startTimeLocal: '2026-11-07 10:50:06', duration: 7261.8, distance: 6281.6, calories: 659, averageHR: 84, maxHR: 131, elevationGain: 388, trainingEffectLabel: 'RECOVERY', aerobicTrainingEffect: 0.9, anaerobicTrainingEffect: 0, activityTrainingLoad: 10.7 },
];
const SLEEP = { dailySleepDTO: { sleepTimeSeconds: 27000, deepSleepSeconds: 5400, lightSleepSeconds: 16200, remSleepSeconds: 4800, awakeSleepSeconds: 600, sleepStartTimestampGMT: 1794000000000, sleepEndTimestampGMT: 1794027000000, sleepScores: { overall: { value: 81 } } } };
const HRV = { hrvSummary: { lastNightAvg: 48, weeklyAvg: 45, status: 'BALANCED', baseline: { balancedLow: 40, balancedUpper: 55 } } };
const WEIGHT = { dailyWeightSummaries: [{ summaryDate: '2026-10-30', latestWeight: { weight: 81250, date: 1793340224000 } }], previousDateWeight: { calendarDate: '2026-10-30', weight: 81250, weightDelta: 300 } };

function makeClient(over = {}) {
  return fakeClient(async (path) => {
    const hit = Object.entries(over).find(([p]) => path.startsWith(p));
    if (hit) { const v = hit[1]; if (typeof v === 'function') return v(path); return v; }
    if (path.startsWith('/usersummary-service/v2/dailysummaries')) return { data: DAYS };
    if (path.startsWith('/activitylist-service/activities/search/activities')) return ACTIVITIES;
    if (path.startsWith('/sleep-service/sleep/dailySleep')) return { dailySleepDTO: { sleepTimeSeconds: 0 } };
    if (path.startsWith('/hrv-service/hrv/2026-11-09')) return {};
    if (path.startsWith('/weight-service/weight/range/')) return WEIGHT;
    throw new Error('unexpected ' + path);
  });
}
const build = (over) => buildBoard(makeClient(over), { today: TODAY, now: () => NOW });
const boom = () => { throw new Error('garmin down'); };

// ---------- pure helpers ----------
test('board: monthStart gives the first of the month', () => {
  assert.equal(monthStart('2026-11-09'), '2026-11-01');
  assert.equal(monthStart('2026-12-31'), '2026-12-01');
});
test('board: weekStart gives the Monday of the week', () => {
  assert.equal(weekStart('2026-11-09'), '2026-11-09');
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
});

// ---------- buildBoard ----------
test('board: top-level fields and link status', async () => {
  const b = await build();
  assert.equal(b.ok, true);
  assert.equal(typeof b.version, 'string');
  assert.equal(b.date, TODAY);
  assert.equal(b.today.date, TODAY);
  assert.equal(b.monthStart, '2026-11-01');
  assert.equal(b.weekStart, '2026-11-09');
  assert.equal(b.link.ok, true);
  assert.equal(b.link.tokenExpiresAt, new Date(Date.parse('2026-11-02T12:00:00Z')).toISOString());
  assert.ok(Array.isArray(b.warnings));
});

test('board: today block reads steps, goal, resting HR and body battery', async () => {
  const t = (await build()).today;
  assert.equal(t.steps, 340);
  assert.equal(t.stepGoal, 12000);
  assert.equal(t.restingHr, 73);
  assert.equal(t.bodyBattery.latest, 83);
});

test('board: today stress of -1 becomes null', async () => {
  assert.equal((await build()).today.stressAvg, null);
});

test('board: month lists days from the 1st to today only', async () => {
  const b = await build({
    '/usersummary-service/v2/dailysummaries': { data: [day('2026-10-31'), ...DAYS] },
  });
  assert.equal(b.month.days.length, 9); // every day from the 1st to today, missing days padded as empty
  assert.equal(b.month.daysWithData, 3);
  assert.ok(!b.month.days.some((d) => d.date === '2026-10-31'));
});

test('board: month totals add up steps, goal days and intensity minutes', async () => {
  const m = (await build()).month;
  assert.equal(m.steps, 12480 + 9876 + 340);
  assert.equal(m.stepGoalDays, 1);
  assert.equal(m.intensityMinutes, (75 + 42) + 30 + (5 + 2));
});

test('board: month totals exclude today from resting heart rate', async () => {
  const m = (await build()).month;
  assert.equal(m.restingHrAvg, 53);
  assert.equal(m.restingHrMin, 51);
  assert.equal(m.restingHrMax, 55);
});

test('board: week block counts intensity minutes from Monday', async () => {
  const w = (await build()).week;
  assert.equal(w.start, '2026-11-09');
  assert.equal(w.intensityMinutes, 5 + 2 * 1);
  assert.equal(w.goal, 600);
});

test('board: activities are sorted newest first with rounded numbers', async () => {
  const a = (await build()).activities;
  assert.equal(a.count, 2);
  assert.equal(a.list[0].type, 'hiking');
  assert.equal(a.list[0].seconds, 7262);
  assert.equal(a.list[0].distanceM, 6282);
  assert.equal(a.list[1].type, 'running');
  assert.equal(a.seconds, 7262 + 1883);
  assert.equal(a.elevationGain, 425);
  assert.equal(a.byType.running.count, 1);
});

test('board: sleep not recorded by default', async () => {
  assert.equal((await build()).sleep.recorded, false);
});
test('board: sleep recorded reads duration, score and deep sleep', async () => {
  const s = (await build({ '/sleep-service/sleep/dailySleep': SLEEP })).sleep;
  assert.equal(s.recorded, true);
  assert.equal(s.seconds, 27000);
  assert.equal(s.score, 81);
  assert.equal(s.deepSeconds, 5400);
});

test('board: hrv not recorded by default', async () => {
  assert.equal((await build()).hrv.recorded, false);
});
test('board: hrv recorded reads last night, status and baseline', async () => {
  const h = (await build({ '/hrv-service/hrv/2026-11-09': HRV })).hrv;
  assert.equal(h.lastNight, 48);
  assert.equal(h.status, 'BALANCED');
  assert.equal(h.baselineLow, 40);
  assert.equal(h.baselineHigh, 55);
});

test('board: weight is shown in kg with date and change', async () => {
  const w = (await build()).weight;
  assert.equal(w.kg, 81.3);
  assert.equal(w.date, '2026-10-30');
  assert.equal(w.deltaKg, 0.3);
});
test('board: empty weight answer gives null', async () => {
  assert.equal((await build({ '/weight-service/weight/range/': {} })).weight, null);
});

test('board: a failing sleep call becomes a warning, not a failure', async () => {
  const b = await build({ '/sleep-service/': boom });
  assert.equal(b.ok, true);
  assert.equal(b.sleep.recorded, false);
  assert.ok(b.warnings.length >= 1);
  assert.ok(b.warnings.some((w) => typeof w === 'string' && /sleep/i.test(w)));
});
test('board: a failing daily summaries call rejects', async () => {
  await assert.rejects(build({ '/usersummary-service/v2/dailysummaries': boom }));
});

// ---------- server ----------
async function withServer(client, fn, cacheMs = 60000) {
  const server = createBoardServer({ client, now: () => NOW, cacheMs });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base); } finally { await new Promise((r) => server.close(r)); server.closeAllConnections?.(); }
}

test('board server: /api/health answers ok with version', async () => {
  await withServer(makeClient(), async (base) => {
    const r = await fetch(base + '/api/health');
    assert.equal(r.status, 200);
    assert.ok(r.headers.get('content-type').includes('application/json'));
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(typeof j.version, 'string');
  });
});

test('board server: /api/board is cached, ?refresh=1 fetches again', async () => {
  const client = makeClient();
  await withServer(client, async (base) => {
    const r1 = await fetch(base + '/api/board');
    assert.equal(r1.status, 200);
    const j = await r1.json();
    assert.equal(j.ok, true);
    assert.equal(j.today.steps === 340 || typeof j.today.steps === 'number', true);
    const n = client.calls.length;
    assert.ok(n > 0);
    await (await fetch(base + '/api/board')).json();
    assert.equal(client.calls.length, n);
    await (await fetch(base + '/api/board?refresh=1')).json();
    assert.ok(client.calls.length > n);
  });
});

test('board server: Garmin down gives 503 with an error text', async () => {
  const client = fakeClient(async () => { throw new Error('garmin down'); });
  await withServer(client, async (base) => {
    const r = await fetch(base + '/api/board');
    assert.equal(r.status, 503);
    const j = await r.json();
    assert.equal(j.ok, false);
    assert.equal(typeof j.error, 'string');
    assert.ok(j.error.length > 0);
  });
});

const IDS = ['board', 'clock-local', 'clock-utc', 'clock-date', 'stardate', 'steps-gauge', 'steps-value', 'body-battery-bar', 'resting-hr', 'stress-bar', 'intensity-gauge', 'floors-value', 'calories-value', 'month-steps-chart', 'month-hr-chart', 'activities-list', 'activities-total', 'sleep-panel', 'hrv-panel', 'weight-thermo', 'link-status', 'last-refresh', 'refresh-button'];

test('board server: / serves the page with every required id', async () => {
  await withServer(makeClient(), async (base) => {
    const r = await fetch(base + '/');
    assert.equal(r.status, 200);
    assert.ok(r.headers.get('content-type').includes('text/html'));
    const html = await r.text();
    for (const id of IDS) assert.ok(html.includes(`id="${id}"`), `missing id ${id}`);
  });
});

test('board server: stylesheet and script are served with the right types', async () => {
  await withServer(makeClient(), async (base) => {
    const css = await fetch(base + '/board.css');
    assert.equal(css.status, 200);
    assert.ok(css.headers.get('content-type').includes('text/css'));
    await css.text();
    const js = await fetch(base + '/board.js');
    assert.equal(js.status, 200);
    assert.ok(js.headers.get('content-type').includes('javascript'));
    await js.text();
  });
});

test('board server: unknown path is 404 and path escape does not leak files', async () => {
  await withServer(makeClient(), async (base) => {
    const r = await fetch(base + '/nothing-here');
    assert.equal(r.status, 404);
    await r.text();
    // fetch normalises ../ so use a raw request too
    const http = await import('node:http');
    const port = new URL(base).port;
    const raw = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/../package.json', method: 'GET' }, (res) => {
        let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject); req.end();
    });
    assert.ok([400, 404].includes(raw.status));
    assert.ok(!raw.body.includes('ams-garmin-mcp'));
    const enc = await fetch(base + '/..%2Fpackage.json');
    assert.ok([400, 404].includes(enc.status));
    assert.ok(!(await enc.text()).includes('ams-garmin-mcp'));
  });
});
