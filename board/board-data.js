// AMS Garmin Board — gathers everything the board shows into one answer.
// One call to buildBoard() asks Garmin for the month so far, the workouts,
// last night's sleep and HRV, and the latest weigh-in, and turns it all into
// plain numbers the page can draw.

import { todayLocal, trimActivity, VERSION } from '../src/tools.js';

const DAY_MS = 86_400_000;

// ---------- dates ----------

function toUtc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** The first day of the month that holds the given day. */
export function monthStart(iso) {
  return iso.slice(0, 8) + '01';
}

/** The Monday of the week that holds the given day (weeks start on Monday in Sweden). */
export function weekStart(iso) {
  const dow = (new Date(toUtc(iso)).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dow);
}

function earlier(a, b) {
  return toUtc(a) <= toUtc(b) ? a : b;
}

// ---------- numbers ----------

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pos = (v) => { const n = num(v); return n === null || n < 0 ? null : n; };
const round = (v) => (num(v) === null ? null : Math.round(v));
const round1 = (v) => (num(v) === null ? null : Math.round(v * 10) / 10);
const sum = (list, pick) => list.reduce((acc, item) => acc + (num(pick(item)) ?? 0), 0);

function stats(values) {
  const list = values.filter((v) => num(v) !== null);
  if (!list.length) return { avg: null, min: null, max: null };
  return {
    avg: Math.round(list.reduce((a, b) => a + b, 0) / list.length),
    min: Math.min(...list),
    max: Math.max(...list),
  };
}

// ---------- one day ----------

function emptyDay(date) {
  return {
    date,
    steps: 0, stepGoal: null, distanceM: 0, floorsUp: 0, floorsGoal: null,
    caloriesTotal: null, caloriesActive: 0, caloriesResting: null,
    restingHr: null, minHr: null, maxHr: null,
    stressAvg: null, stressMax: null,
    bodyBattery: { latest: null, min: null, max: null, charged: null, drained: null },
    intensityModerate: 0, intensityVigorous: 0, intensityWeeklyGoal: null,
    respirationAvg: null,
    hasData: false,
  };
}

/** Turns one raw Garmin daily summary into the board's view of a day. */
export function dayView(raw) {
  const d = raw || {};
  const mv = d.movement || {};
  const steps = mv.steps || {};
  const floors = mv.floorsAscended || {};
  const cal = d.calories || {};
  const hr = d.heartRate || {};
  const im = d.intensityMinutes || {};
  const st = d.stress || {};
  const bb = d.bodyBattery || {};
  const resp = d.respiration || {};
  return {
    date: d.calendarDate,
    steps: num(steps.value) ?? 0,
    stepGoal: pos(steps.goal),
    distanceM: round(steps.distanceInMeters) ?? 0,
    floorsUp: round(floors.value) ?? 0,
    floorsGoal: pos(floors.goal),
    caloriesTotal: round(cal.burnedTotal),
    caloriesActive: round(cal.burnedActive) ?? 0,
    caloriesResting: round(cal.burnedResting),
    restingHr: pos(hr.restingValue),
    minHr: pos(hr.minValue),
    maxHr: pos(hr.maxValue),
    stressAvg: pos(st.avgLevel),
    stressMax: pos(st.maxLevel),
    bodyBattery: {
      latest: pos(bb.latestValue),
      min: pos(bb.minValue),
      max: pos(bb.maxValue),
      charged: pos(bb.chargedValue),
      drained: pos(bb.drainedValue),
    },
    intensityModerate: pos(im.moderate) ?? 0,
    intensityVigorous: pos(im.vigorous) ?? 0,
    intensityWeeklyGoal: pos(im.goal),
    respirationAvg: pos(resp.avgValue),
    hasData: true,
  };
}

/** Garmin counts a vigorous minute as two intensity minutes. */
export function intensityOf(day) {
  return (day.intensityModerate ?? 0) + 2 * (day.intensityVigorous ?? 0);
}

// ---------- activities ----------

function activityView(raw) {
  const a = trimActivity(raw) || {};
  return {
    id: a.activityId ?? null,
    name: a.activityName ?? '',
    type: typeof a.activityType === 'string' ? a.activityType : (a.activityType?.typeKey ?? 'other'),
    start: a.startTimeLocal ?? null,
    seconds: round(a.duration) ?? 0,
    distanceM: round(a.distance) ?? 0,
    calories: round(a.calories),
    avgHr: round(a.averageHR),
    maxHr: round(a.maxHR),
    elevationGain: round(a.elevationGain),
    trainingEffect: a.trainingEffectLabel ?? null,
    aerobic: round1(a.aerobicTrainingEffect),
    anaerobic: round1(a.anaerobicTrainingEffect),
    load: round(a.activityTrainingLoad),
  };
}

function activitiesView(rawList) {
  const list = (Array.isArray(rawList) ? rawList : [])
    .map(activityView)
    .sort((a, b) => String(b.start ?? '').localeCompare(String(a.start ?? '')));
  const byType = {};
  for (const a of list) {
    const t = byType[a.type] ?? (byType[a.type] = { count: 0, seconds: 0, distanceM: 0 });
    t.count += 1;
    t.seconds += a.seconds;
    t.distanceM += a.distanceM;
  }
  return {
    count: list.length,
    seconds: sum(list, (a) => a.seconds),
    distanceM: sum(list, (a) => a.distanceM),
    calories: sum(list, (a) => a.calories),
    elevationGain: sum(list, (a) => a.elevationGain),
    byType,
    list,
  };
}

// ---------- sleep, HRV, weight ----------

function sleepView(raw) {
  const dto = raw?.dailySleepDTO;
  const seconds = pos(dto?.sleepTimeSeconds);
  if (!dto || !seconds) return { recorded: false };
  return {
    recorded: true,
    seconds,
    score: pos(dto.sleepScores?.overall?.value),
    deepSeconds: pos(dto.deepSleepSeconds) ?? 0,
    lightSeconds: pos(dto.lightSleepSeconds) ?? 0,
    remSeconds: pos(dto.remSleepSeconds) ?? 0,
    awakeSeconds: pos(dto.awakeSleepSeconds) ?? 0,
    start: num(dto.sleepStartTimestampGMT) ? new Date(dto.sleepStartTimestampGMT).toISOString() : null,
    end: num(dto.sleepEndTimestampGMT) ? new Date(dto.sleepEndTimestampGMT).toISOString() : null,
  };
}

function hrvView(raw) {
  const s = raw?.hrvSummary;
  const lastNight = pos(s?.lastNightAvg);
  if (!s || lastNight === null) return { recorded: false };
  return {
    recorded: true,
    lastNight,
    weeklyAvg: pos(s.weeklyAvg),
    status: s.status ?? null,
    baselineLow: pos(s.baseline?.balancedLow),
    baselineHigh: pos(s.baseline?.balancedUpper),
  };
}

function weightView(raw) {
  const summaries = Array.isArray(raw?.dailyWeightSummaries) ? raw.dailyWeightSummaries : [];
  const withWeight = summaries.filter((s) => pos(s?.latestWeight?.weight));
  if (withWeight.length) {
    const last = withWeight.sort((a, b) => String(a.summaryDate).localeCompare(String(b.summaryDate))).at(-1);
    const prev = withWeight.length > 1 ? withWeight.at(-2) : null;
    const kg = round1(last.latestWeight.weight / 1000);
    const deltaKg = prev ? round1((last.latestWeight.weight - prev.latestWeight.weight) / 1000)
      : round1((raw?.previousDateWeight?.weightDelta ?? 0) / 1000);
    return { kg, date: last.summaryDate ?? null, deltaKg };
  }
  const prev = raw?.previousDateWeight;
  if (pos(prev?.weight)) {
    return { kg: round1(prev.weight / 1000), date: prev.calendarDate ?? null, deltaKg: round1((prev.weightDelta ?? 0) / 1000) };
  }
  return null;
}

// ---------- the board ----------

/**
 * Builds the whole board in one go.
 * The daily summaries are the heart of it: if Garmin refuses those, the call fails.
 * Every other part (workouts, sleep, HRV, weight) falls back to "nothing" and leaves a warning.
 */
export async function buildBoard(client, { today = todayLocal(), now = () => Date.now() } = {}) {
  const warnings = [];
  const side = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      warnings.push(`${label}: ${err?.message || String(err)}`);
      return fallback;
    }
  };

  const mStart = monthStart(today);
  const wStart = weekStart(today);
  const rangeStart = earlier(mStart, wStart);

  const daysRaw = await client.get('/usersummary-service/v2/dailysummaries', { startDate: rangeStart, endDate: today });
  const daysList = Array.isArray(daysRaw?.data) ? daysRaw.data : (Array.isArray(daysRaw) ? daysRaw : []);
  const byDate = new Map(daysList.filter((d) => d?.calendarDate).map((d) => [d.calendarDate, dayView(d)]));
  const allDays = [];
  for (let d = rangeStart; toUtc(d) <= toUtc(today); d = addDays(d, 1)) {
    allDays.push(byDate.get(d) ?? emptyDay(d));
  }

  const [activitiesRaw, sleepRaw, hrvRaw, weightRaw, token] = await Promise.all([
    side('workouts', () => client.get('/activitylist-service/activities/search/activities', {
      startDate: mStart, endDate: today, limit: 99, start: 0,
    }), []),
    side('sleep', () => client.get('/sleep-service/sleep/dailySleep', { date: today }), null),
    side('HRV', () => client.get(`/hrv-service/hrv/${today}`), null),
    side('weight', () => client.get(`/weight-service/weight/range/${addDays(today, -60)}/${today}`, { includeAll: false }), null),
    side('link', () => client.tokenInfo?.(), null),
  ]);

  const monthDays = allDays.filter((d) => toUtc(d.date) >= toUtc(mStart));
  const finished = monthDays.filter((d) => d.date !== today && d.hasData);
  const todayDay = byDate.get(today) ?? emptyDay(today);
  const hrStats = stats(finished.map((d) => d.restingHr));
  const weekDays = allDays.filter((d) => toUtc(d.date) >= toUtc(wStart));
  const weeklyGoal = todayDay.intensityWeeklyGoal
    ?? monthDays.map((d) => d.intensityWeeklyGoal).find((g) => g !== null)
    ?? null;

  const withData = monthDays.filter((d) => d.hasData).length;
  const strip = ({ hasData, ...rest }) => rest;

  return {
    ok: true,
    version: VERSION,
    generatedAt: new Date(now()).toISOString(),
    date: today,
    monthStart: mStart,
    weekStart: wStart,
    link: {
      ok: true,
      tokenExpiresAt: num(token?.expiresAt) ? new Date(token.expiresAt).toISOString() : null,
    },
    today: strip(todayDay),
    month: {
      days: monthDays.map(strip),
      steps: sum(monthDays, (d) => d.steps),
      avgSteps: withData ? Math.round(sum(monthDays, (d) => d.steps) / withData) : 0,
      stepGoalDays: monthDays.filter((d) => d.stepGoal && d.steps >= d.stepGoal).length,
      daysWithData: monthDays.filter((d) => d.hasData).length,
      distanceM: sum(monthDays, (d) => d.distanceM),
      floorsUp: sum(monthDays, (d) => d.floorsUp),
      intensityMinutes: sum(monthDays, intensityOf),
      restingHrAvg: hrStats.avg,
      restingHrMin: hrStats.min,
      restingHrMax: hrStats.max,
    },
    week: {
      start: wStart,
      intensityMinutes: sum(weekDays, intensityOf),
      goal: weeklyGoal,
    },
    activities: activitiesView(activitiesRaw),
    sleep: sleepView(sleepRaw),
    hrv: hrvView(hrvRaw),
    weight: weightView(weightRaw),
    warnings,
  };
}
