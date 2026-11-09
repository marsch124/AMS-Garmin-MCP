import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GarminError } from '../src/garmin-client.js';
import { TOOLS, isIsoDate, splitRange, compact, trimActivity, todayLocal } from '../src/tools.js';
import { fakeClient, byTool, TOOL_NAMES } from './helpers.js';

const run = (name, args, client) => byTool(TOOLS, name).handler(args, client);
const code = (c) => (e) => e instanceof GarminError && e.code === c;
const days = (from, n) => {
  const d = new Date(from + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n - 1);
  return d.toISOString().slice(0, 10);
};

// ---------- pure helpers ----------
test('isIsoDate accepts only valid calendar dates', () => {
  assert.equal(isIsoDate('2026-11-01'), true);
  assert.equal(isIsoDate('2024-02-29'), true);
  for (const bad of ['2026-02-30', '2026-13-01', 'yesterday', '2026-1-1', '', '2026-11-01T00:00', undefined, 20261101]) {
    assert.equal(isIsoDate(bad), false, String(bad));
  }
});

test('splitRange chunks inclusively', () => {
  const c = splitRange('2026-01-01', '2026-03-01', 28); // 60 days
  assert.equal(c.length, 3);
  assert.equal(c[0].startDate, '2026-01-01');
  assert.equal(c[0].endDate, '2026-01-28');
  assert.equal(c[1].startDate, '2026-01-29');
  assert.equal(c[2].endDate, '2026-03-01');
  assert.deepEqual(splitRange('2026-05-05', '2026-05-05', 28), [{ startDate: '2026-05-05', endDate: '2026-05-05' }]);
});

test('splitRange rejects reversed or invalid ranges with BAD_RANGE', () => {
  assert.throws(() => splitRange('2026-05-05', '2026-05-04', 28), code('BAD_RANGE'));
  assert.throws(() => splitRange('2026-02-30', '2026-03-04', 28), code('BAD_RANGE'));
  assert.throws(() => splitRange('x', 'y', 28), code('BAD_RANGE'));
});

test('compact removes null/empty but keeps 0 and false', () => {
  assert.deepEqual(
    compact({ a: null, b: undefined, c: [], d: {}, e: 0, f: false, g: { h: null, i: 1 }, j: [null, 2, {}], k: '' === '' ? 'x' : 0 }),
    { e: 0, f: false, g: { i: 1 }, j: [2], k: 'x' },
  );
});

test('trimActivity keeps the allowlist and flattens type keys', () => {
  const r = trimActivity({
    activityId: 1, activityName: 'Run', activityType: { typeKey: 'running', typeId: 1 },
    eventType: { typeKey: 'race' }, distance: 5000, averageHR: 150, isPR: false,
    ownerProfileImageUrlLarge: 'http://x', userRoles: ['a'],
  });
  assert.equal(r.activityId, 1);
  assert.equal(r.activityType, 'running');
  assert.equal(r.eventType, 'race');
  assert.equal(r.distance, 5000);
  assert.equal(r.isPR, false);
  assert.equal('ownerProfileImageUrlLarge' in r, false);
  assert.equal('userRoles' in r, false);
});

test('todayLocal gives local YYYY-MM-DD', () => {
  const now = new Date(2026, 10, 9, 23, 30); // local time
  assert.equal(todayLocal(now), '2026-11-09');
  assert.match(todayLocal(), /^\d{4}-\d{2}-\d{2}$/);
});

// ---------- tool list ----------
test('exactly the 22 tools, each with description and handler', () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), [...TOOL_NAMES].sort());
  for (const t of TOOLS) {
    assert.ok(t.description && t.description.length > 0, t.name);
    assert.equal(typeof t.handler, 'function', t.name);
    assert.ok(t.inputSchema && typeof t.inputSchema === 'object', t.name);
    assert.ok(t.title, t.name);
  }
});

// ---------- activities ----------
const rawAct = { activityId: 7, activityName: 'Run', activityType: { typeKey: 'running' }, ownerProfileImageUrlLarge: 'u', distance: 1000 };

test('garmin_activities: defaults, query and trimming', async () => {
  const c = fakeClient(async () => [rawAct]);
  const r = await run('garmin_activities', {}, c);
  assert.equal(c.calls[0].path, '/activitylist-service/activities/search/activities');
  assert.equal(c.calls[0].query.start, 0);
  assert.equal(c.calls[0].query.limit, 20);
  assert.equal(c.calls[0].query.sortOrder, 'desc');
  assert.equal(r[0].activityType, 'running');
  assert.equal('ownerProfileImageUrlLarge' in r[0], false);
});

test('garmin_activities: filters pass through, full returns untrimmed', async () => {
  const c = fakeClient(async () => [rawAct]);
  const r = await run('garmin_activities', { startDate: '2026-10-01', endDate: '2026-10-31', activityType: 'running', search: 'park', limit: 5, full: true }, c);
  const q = c.calls[0].query;
  assert.equal(q.startDate, '2026-10-01');
  assert.equal(q.endDate, '2026-10-31');
  assert.equal(q.activityType, 'running');
  assert.equal(q.search, 'park');
  assert.equal(q.limit, 5);
  assert.equal(r[0].ownerProfileImageUrlLarge, 'u');
});

test('garmin_activity: one call, or two with includeWorkouts', async () => {
  const c = fakeClient(async (p) => (p.endsWith('/workouts') ? [{ w: 1 }] : { activityId: 5 }));
  const a = await run('garmin_activity', { activityId: 5 }, c);
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].path, '/activity-service/activity/5');
  assert.equal(a.activityId, 5);
  const c2 = fakeClient(async (p) => (p.endsWith('/workouts') ? [{ w: 1 }] : { activityId: 5 }));
  const b = await run('garmin_activity', { activityId: 5, includeWorkouts: true }, c2);
  assert.ok(c2.calls.some((x) => x.path === '/activity-service/activity/5/workouts'));
  assert.deepEqual(b.workouts, [{ w: 1 }]);
  assert.equal(b.activityId, 5);
});

test('garmin_activity_file writes the buffer into the folder', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'garmin-act-'));
  const c = fakeClient();
  const r = await run('garmin_activity_file', { activityId: 99, folder: dir, directory: dir, dir }, c);
  assert.equal(c.calls[0].path, '/download-service/files/activity/99');
  assert.equal(c.calls[0].binary, true);
  assert.ok(r.path.startsWith(dir));
  assert.equal(r.bytes, 7);
  assert.equal(await readFile(r.path, 'utf8'), 'FITDATA');
});

// ---------- day / days ----------
test('garmin_day uses given date or today', async () => {
  const c = fakeClient(async () => ({ steps: 1 }));
  await run('garmin_day', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/usersummary-service/usersummary/daily');
  assert.equal(c.calls[0].query.calendarDate, '2026-11-01');
  const c2 = fakeClient(async () => ({ steps: 1 }));
  await run('garmin_day', {}, c2);
  assert.equal(c2.calls[0].query.calendarDate, todayLocal());
});

test('garmin_days chunks by 365 days and concatenates data', async () => {
  const c = fakeClient(async (p, q) => ({ data: [{ d: q.startDate }] }));
  const r = await run('garmin_days', { startDate: '2025-01-01', endDate: '2026-02-10' }, c); // 406 days
  assert.equal(c.calls.length, 2);
  assert.equal(c.calls[0].path, '/usersummary-service/v2/dailysummaries');
  assert.equal(c.calls[0].query.startDate, '2025-01-01');
  assert.equal(c.calls[0].query.endDate, '2025-12-31');
  assert.equal(JSON.stringify(r).includes('2026-01-01'), true);
});

// ---------- sleep ----------
test('garmin_sleep single date and chunked range', async () => {
  const c = fakeClient(async () => ({ s: 1 }));
  await run('garmin_sleep', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/sleep-service/sleep/dailySleep');
  assert.equal(c.calls[0].query.date, '2026-11-01');
  const c2 = fakeClient(async () => [{ x: 1 }]);
  const r = await run('garmin_sleep', { startDate: '2026-01-01', endDate: days('2026-01-01', 40) }, c2);
  assert.equal(c2.calls.length, 2);
  assert.ok(c2.calls.every((x) => x.path === '/sleep-service/sleep/dailySleepSummariesByDate'));
  assert.equal(JSON.stringify(r).match(/"x":1/g).length, 2);
});

// ---------- hrv ----------
test('garmin_hrv single date strips readings unless asked', async () => {
  const mk = () => fakeClient(async () => ({ hrvSummary: { a: 1 }, hrvReadings: [{ v: 1 }] }));
  const c = mk();
  const r = await run('garmin_hrv', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/hrv-service/hrv/2026-11-01');
  assert.equal('hrvReadings' in r, false);
  const r2 = await run('garmin_hrv', { date: '2026-11-01', includeReadings: true }, mk());
  assert.deepEqual(r2.hrvReadings, [{ v: 1 }]);
});

test('garmin_hrv range uses daily path and concatenates hrvSummaries', async () => {
  const c = fakeClient(async () => ({ hrvSummaries: [{ k: 1 }] }));
  const r = await run('garmin_hrv', { startDate: '2026-10-01', endDate: '2026-10-07' }, c);
  assert.equal(c.calls[0].path, '/hrv-service/hrv/daily/2026-10-01/2026-10-07');
  assert.ok(JSON.stringify(r).includes('"k":1'));
});

// ---------- stats families ----------
for (const [tool, family, size] of [
  ['garmin_stress', '/usersummary-service/stats/stress/daily/', 28],
  ['garmin_steps', '/usersummary-service/stats/steps/daily/', 28],
  ['garmin_hydration', '/usersummary-service/stats/hydration/daily/', 31],
]) {
  test(`${tool} chunks by ${size}`, async () => {
    const c = fakeClient(async () => [{ v: 1 }]);
    await run(tool, { startDate: '2026-01-01', endDate: days('2026-01-01', size + 2) }, c);
    assert.equal(c.calls.length, 2);
    assert.ok(c.calls[0].path.startsWith(family));
    assert.equal(c.calls[0].path, `${family}2026-01-01/${days('2026-01-01', size)}`);
    const one = fakeClient(async () => [{ v: 1 }]);
    await run(tool, { startDate: '2026-01-01', endDate: days('2026-01-01', size) }, one);
    assert.equal(one.calls.length, 1);
  });
}

test('garmin_stress 30-day range is 2 calls', async () => {
  const c = fakeClient(async () => []);
  await run('garmin_stress', { startDate: '2026-01-01', endDate: '2026-01-30' }, c);
  assert.equal(c.calls.length, 2);
});

// ---------- body battery, hr, spo2 ----------
test('garmin_body_battery chunks by 31 and strips series', async () => {
  const mk = () => fakeClient(async () => [{ date: 'x', bodyBatteryValuesArray: [[1, 2]], charged: 5 }]);
  const c = mk();
  const r = await run('garmin_body_battery', { startDate: '2026-01-01', endDate: days('2026-01-01', 40) }, c);
  assert.equal(c.calls.length, 2);
  assert.equal(c.calls[0].path, '/wellness-service/wellness/bodyBattery/reports/daily');
  assert.equal(c.calls[0].query.startDate, '2026-01-01');
  assert.ok(!JSON.stringify(r).includes('bodyBatteryValuesArray'));
  assert.ok(JSON.stringify(r).includes('"charged":5'));
  const r2 = await run('garmin_body_battery', { startDate: '2026-01-01', endDate: '2026-01-02', includeSeries: true }, mk());
  assert.ok(JSON.stringify(r2).includes('bodyBatteryValuesArray'));
});

test('garmin_heart_rate strips heartRateValues unless includeSeries', async () => {
  const mk = () => fakeClient(async () => ({ restingHeartRate: 50, heartRateValues: [[1, 60]] }));
  const c = mk();
  const r = await run('garmin_heart_rate', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/wellness-service/wellness/dailyHeartRate');
  assert.equal(c.calls[0].query.date, '2026-11-01');
  assert.equal('heartRateValues' in r, false);
  assert.equal(r.restingHeartRate, 50);
  const r2 = await run('garmin_heart_rate', { date: '2026-11-01', includeSeries: true }, mk());
  assert.ok(r2.heartRateValues);
});

test('garmin_spo2 strips series unless includeSeries', async () => {
  const mk = () => fakeClient(async () => ({ avg: 95, spO2SingleValues: [1], spO2HourlyAverages: [2] }));
  const c = mk();
  const r = await run('garmin_spo2', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/wellness-service/wellness/daily/spo2acclimation/2026-11-01');
  assert.equal('spO2SingleValues' in r, false);
  assert.equal('spO2HourlyAverages' in r, false);
  const r2 = await run('garmin_spo2', { date: '2026-11-01', includeSeries: true }, mk());
  assert.ok(r2.spO2SingleValues && r2.spO2HourlyAverages);
});

// ---------- weight ----------
test('garmin_weight with and without goal', async () => {
  const c = fakeClient(async (p) => (p.startsWith('/goal-service') ? { goal: 70 } : { w: 1 }));
  await run('garmin_weight', { startDate: '2026-10-01', endDate: '2026-10-31', includeAll: true }, c);
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].path, '/weight-service/weight/range/2026-10-01/2026-10-31');
  assert.equal(c.calls[0].query.includeAll, true);
  const c2 = fakeClient(async (p) => (p.startsWith('/goal-service') ? { goal: 70 } : { w: 1 }));
  const r = await run('garmin_weight', { startDate: '2026-10-01', endDate: '2026-10-31', includeGoal: true }, c2);
  assert.ok(c2.calls.some((x) => x.path === '/goal-service/goal/user/effective/weightgoal/2026-10-01/2026-10-31'));
  assert.deepEqual(r.goal, { goal: 70 });
});

// ---------- single-path tools ----------
test('fitness age, zones, nutrition, wellness activities, menstrual cycle', async () => {
  let c = fakeClient(async () => ({ a: 1 }));
  await run('garmin_fitness_age', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/fitnessage-service/fitnessage/v2/2026-11-01');

  c = fakeClient(async () => ({ a: 1 }));
  await run('garmin_heart_rate_zones', {}, c);
  assert.equal(c.calls[0].path, '/biometric-service/heartRateZones/v2');

  c = fakeClient(async () => ({ a: 1 }));
  await run('garmin_nutrition', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/nutrition-service/food/logs/2026-11-01');

  c = fakeClient(async () => [{ a: 1 }]);
  await run('garmin_wellness_activities', { startDate: '2026-01-01', endDate: days('2026-01-01', 40) }, c);
  assert.equal(c.calls.length, 2);
  assert.equal(c.calls[0].path, '/wellnessactivity-service/activity/summary/range/2026-01-01/2026-01-31');

  c = fakeClient(async () => ({ a: 1 }));
  await run('garmin_menstrual_cycle', { date: '2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/periodichealth-service/menstrualcycle/summary/2026-11-01');
  c = fakeClient(async () => ({ a: 1 }));
  await run('garmin_menstrual_cycle', { date: '2026-11-01', detailed: true }, c);
  assert.equal(c.calls[0].path, '/periodichealth-service/menstrualcycle/dayview/2026-11-01');
});

// ---------- profile / status ----------
test('garmin_profile and garmin_status read the settings endpoint', async () => {
  const settings = { measurementSystem: 'metric', timeZone: 'Europe/Stockholm', displayName: 'martin' };
  let c = fakeClient(async () => settings);
  await run('garmin_profile', {}, c);
  assert.equal(c.calls[0].path, '/userprofile-service/userprofile/settings');
  c = fakeClient(async () => settings);
  const s = await run('garmin_status', {}, c);
  assert.equal(c.calls[0].path, '/userprofile-service/userprofile/settings');
  assert.equal(s.connected, true);
  for (const k of ['displayName', 'measurementSystem', 'timeZone', 'keyFile', 'tokenExpiresAt']) assert.ok(k in s, k);
});

// ---------- raw ----------
test('garmin_raw allows documented templates, passes query, rejects others', async () => {
  const c = fakeClient(async () => ({ ok: 1 }));
  await run('garmin_raw', { path: '/hrv-service/hrv/2026-11-01' }, c);
  assert.equal(c.calls[0].path, '/hrv-service/hrv/2026-11-01');
  await run('garmin_raw', { path: '/sleep-service/sleep/dailySleep', query: { date: '2026-11-01' } }, c);
  assert.equal(c.calls[1].query.date, '2026-11-01');
  await assert.rejects(run('garmin_raw', { path: '/anything-else/x' }, c), code('BAD_PATH'));
  assert.equal(c.calls.length, 2);
});

// ---------- dates ----------
test('invalid dates give BAD_DATE', async () => {
  for (const bad of ['2026-13-01', 'yesterday', '2026-02-30']) {
    await assert.rejects(run('garmin_day', { date: bad }, fakeClient()), code('BAD_DATE'), bad);
    await assert.rejects(run('garmin_heart_rate', { date: bad }, fakeClient()), code('BAD_DATE'), bad);
    await assert.rejects(run('garmin_stress', { startDate: bad, endDate: '2026-11-01' }, fakeClient()), code('BAD_DATE'), bad);
    await assert.rejects(run('garmin_sleep', { date: bad }, fakeClient()), code('BAD_DATE'), bad);
  }
});
