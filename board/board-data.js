// AMS Garmin Board — gathers everything the board shows into one answer.
// buildBoard() asks Garmin for the year so far (daily summaries and workouts),
// last night, the last seven nights, the weigh-ins of 90 days, fitness age,
// heart-rate zones and today's Body Battery curve, and turns it all into plain
// numbers the page can draw. buildMonth() does the same for one past month.

import { todayLocal, trimActivity, VERSION } from '../src/tools.js';
import { BoardStore, DEFAULT_TARGETS, HOME_ZONE } from './store.js';

const DAY_MS = 86_400_000;
const pad2 = (n) => String(n).padStart(2, '0');
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function monthEnd(ym) {
  return `${ym}-${pad2(daysInMonth(ym))}`;
}
export function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
}
export function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
}
export function isoWeek(iso) {
  const d = new Date(toUtc(iso));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
}
const earlier = (a, b) => (toUtc(a) <= toUtc(b) ? a : b);
const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
const dayOfMonth = (iso) => Number(iso.slice(8, 10));
const isYm = (s) => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);

/** Garmin's GMT stamps look like "2026-11-08T22:30:00.0" (no Z) — normalise to ISO. */
export function parseGmt(s) {
  if (typeof s !== 'string' || !s) return null;
  let t = s.trim();
  if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(t)) t = t.replace(/\.(\d+)$/, (_, f) => '.' + (f + '00').slice(0, 3)) + 'Z';
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

// ---------- numbers ----------

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pos = (v) => { const n = num(v); return n === null || n < 0 ? null : n; };
const round = (v) => (num(v) === null ? null : Math.round(v));
const round1 = (v) => (num(v) === null ? null : Math.round(v * 10) / 10);
const round2 = (v) => (num(v) === null ? null : Math.round(v * 100) / 100);
const sum = (list, pick) => list.reduce((acc, item) => acc + (num(pick(item)) ?? 0), 0);
const pct = (now, before) => (num(before) && before !== 0 ? Math.round(((now - before) / before) * 100) : null);

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

const strip = ({ hasData, ...rest }) => rest;
const goalMet = (d) => !!(d.stepGoal && d.steps >= d.stepGoal);

// ---------- fetching ----------

/** Daily summaries for a range, padded so every day exists (chunks of at most 365 days). */
async function fetchDays(client, start, end) {
  const byDate = new Map();
  for (let s = start; toUtc(s) <= toUtc(end);) {
    const e = earlier(addDays(s, 364), end);
    const raw = await client.get('/usersummary-service/v2/dailysummaries', { startDate: s, endDate: e });
    const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    for (const d of list) if (d?.calendarDate) byDate.set(d.calendarDate, dayView(d));
    s = addDays(e, 1);
  }
  const all = [];
  for (let d = start; toUtc(d) <= toUtc(end); d = addDays(d, 1)) all.push(byDate.get(d) ?? emptyDay(d));
  return { all, byDate };
}

/** Every workout in a range (Garmin pages by 99). */
async function fetchActivities(client, start, end) {
  const out = [];
  for (let page = 0; page < 30; page++) {
    const part = await client.get('/activitylist-service/activities/search/activities', {
      startDate: start, endDate: end, limit: 99, start: page * 99,
    });
    const list = Array.isArray(part) ? part : (Array.isArray(part?.data) ? part.data : []);
    out.push(...list);
    if (list.length < 99) break;
  }
  return out;
}

// ---------- activities ----------

function activityView(raw) {
  const a = trimActivity(raw) || {};
  const start = a.startTimeLocal ?? null;
  return {
    id: a.activityId ?? null,
    name: a.activityName ?? '',
    type: typeof a.activityType === 'string' ? a.activityType : (a.activityType?.typeKey ?? 'other'),
    start,
    date: typeof start === 'string' ? start.slice(0, 10) : null,
    seconds: round(a.duration) ?? 0,
    distanceM: round(a.distance) ?? 0,
    calories: round(a.calories),
    avgHr: round(a.averageHR),
    maxHr: round(a.maxHR),
    elevationGain: round(a.elevationGain),
    trainingEffect: a.trainingEffectLabel ?? null,
    aerobic: round1(a.aerobicTrainingEffect),
    anaerobic: round1(a.anaerobicTrainingEffect),
    load: round1(a.activityTrainingLoad),
    vo2max: pos(a.vO2MaxValue),
    place: a.locationName ?? null,
    zones: [1, 2, 3, 4, 5].map((n) => pos(raw?.[`hrTimeInZone_${n}`]) ?? 0),
    lat: num(raw?.startLatitude),
    lon: num(raw?.startLongitude),
  };
}

function activitiesView(list) {
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

const inMonth = (ym) => (x) => typeof x.date === 'string' && x.date.startsWith(ym);
const SWIM_TYPES = new Set(['lap_swimming', 'open_water_swimming', 'swimming']);
const RUN_TYPES = new Set(['running', 'treadmill_running', 'trail_running', 'indoor_running', 'track_running', 'virtual_run']);
export const isSwim = (type) => SWIM_TYPES.has(type);
export const isRun = (type) => RUN_TYPES.has(type);

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
    napSeconds: pos(dto.napTimeSeconds) ?? 0,
    needMinutes: pos(dto.sleepNeed?.actual) ?? pos(dto.sleepNeed?.baseline),
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
    const sorted = [...withWeight].sort((a, b) => String(a.summaryDate).localeCompare(String(b.summaryDate)));
    const last = sorted.at(-1);
    const prev = sorted.length > 1 ? sorted.at(-2) : null;
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

/** 90 days of weigh-ins, a 7-day average and Garmin's goal. */
function weightTrendView(rangeRaw, goalRaw, days = 90) {
  const summaries = Array.isArray(rangeRaw?.dailyWeightSummaries) ? rangeRaw.dailyWeightSummaries : [];
  const points = summaries
    .filter((s) => pos(s?.latestWeight?.weight) && typeof s.summaryDate === 'string')
    .map((s) => ({ date: s.summaryDate, kg: round1(s.latestWeight.weight / 1000) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const avg7 = points.map((p) => {
    const from = addDays(p.date, -6);
    const win = points.filter((q) => q.date >= from && q.date <= p.date);
    return { date: p.date, kg: round1(win.reduce((a, q) => a + q.kg, 0) / win.length) };
  });
  const goals = Array.isArray(goalRaw?.userGoals) ? goalRaw.userGoals : [];
  const goal = goals
    .filter((g) => g?.userGoalType === 'WEIGHT_GRAMS' && pos(g.goalValue))
    .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0];
  return { days, points, avg7, goalKg: goal ? round1(goal.goalValue / 1000) : null };
}

/** Need against actual sleep over the last seven nights (nights without sleep data are skipped). */
function sleepDebtView(raw, today) {
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
  const byDate = new Map();
  for (const e of list) {
    const date = e?.calendarDate ?? e?.sleepNeed?.calendarDate ?? null;
    if (date) byDate.set(date, e);
  }
  const nights = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const e = byDate.get(date);
    const needMin = pos(e?.sleepNeed?.actual) ?? pos(e?.sleepNeed?.baseline) ?? null;
    const sleptMin = pos(e?.sleepTimeSeconds) ? Math.round(e.sleepTimeSeconds / 60) : 0;
    const napMin = pos(e?.napTimeSeconds) ? Math.round(e.napTimeSeconds / 60) : 0;
    nights.push({ date, needMin, sleptMin, napMin, recorded: sleptMin > 0 });
  }
  const counted = nights.filter((n) => n.recorded && num(n.needMin) !== null);
  return {
    recorded: counted.length > 0,
    missingRecent: nights.slice(-3).filter((n) => !n.recorded).length,
    nights,
    debtMin: counted.length ? counted.reduce((a, n) => a + (n.needMin - n.sleptMin - n.napMin), 0) : null,
  };
}

/** Today's Body Battery readings and the sleep / activity / recovery spans Garmin marked. */
function bodyBatteryCurveView(raw, today) {
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
  const entry = list.find((e) => e?.date === today) ?? list[0] ?? null;
  const points = (Array.isArray(entry?.bodyBatteryValuesArray) ? entry.bodyBatteryValuesArray : [])
    .filter((p) => Array.isArray(p) && num(p[0]) !== null && num(p[1]) !== null)
    .map((p) => [p[0], p[1]]);
  const events = (Array.isArray(entry?.bodyBatteryActivityEvent) ? entry.bodyBatteryActivityEvent : [])
    .map((e) => {
      const startMs = parseGmt(e?.eventStartTimeGmt);
      const dur = pos(e?.durationInMilliseconds) ?? 0;
      return { type: typeof e?.eventType === 'string' ? e.eventType : 'EVENT', startMs, endMs: startMs === null ? null : startMs + dur, impact: num(e?.bodyBatteryImpact) };
    })
    .filter((e) => e.startMs !== null);
  return { points, events };
}

// ---------- the new 1.2 blocks ----------

function monthView(allDays, ym, today) {
  const days = allDays.filter(inMonth(ym));
  const finished = days.filter((d) => d.date !== today && d.hasData);
  const hr = stats(finished.map((d) => d.restingHr));
  const withData = days.filter((d) => d.hasData).length;
  return {
    ym,
    days: days.map(strip),
    steps: sum(days, (d) => d.steps),
    avgSteps: withData ? Math.round(sum(days, (d) => d.steps) / withData) : 0,
    stepGoalDays: days.filter(goalMet).length,
    daysWithData: withData,
    distanceM: sum(days, (d) => d.distanceM),
    floorsUp: sum(days, (d) => d.floorsUp),
    intensityMinutes: sum(days, intensityOf),
    restingHrAvg: hr.avg,
    restingHrMin: hr.min,
    restingHrMax: hr.max,
  };
}

/** This month against the previous one, through the same day of the month. */
function compareView(allDays, acts, ym, today) {
  const prev = prevMonth(ym);
  const lastDay = today.startsWith(ym) ? dayOfMonth(today) : daysInMonth(ym);
  const throughDay = Math.min(lastDay, daysInMonth(prev));
  const upTo = (list, month, limit) => list.filter((x) => inMonth(month)(x) && dayOfMonth(x.date) <= limit);
  const cur = upTo(allDays, ym, throughDay);
  const before = upTo(allDays, prev, throughDay);
  const beforeFull = allDays.filter(inMonth(prev));
  const curActs = upTo(acts, ym, throughDay);
  const beforeActs = upTo(acts, prev, throughDay);
  const beforeActsFull = acts.filter(inMonth(prev));
  const block = (pick) => {
    const now = sum(cur, pick), b = sum(before, pick);
    return { now, before: b, beforeFull: sum(beforeFull, pick), pct: pct(now, b) };
  };
  const hrNow = stats(cur.filter((d) => d.date !== today).map((d) => d.restingHr)).avg;
  const hrBefore = stats(before.map((d) => d.restingHr)).avg;
  const trainNow = sum(curActs, (a) => a.seconds), trainBefore = sum(beforeActs, (a) => a.seconds);
  return {
    previousMonth: prev,
    throughDay,
    steps: block((d) => d.steps),
    distanceM: block((d) => d.distanceM),
    floorsUp: block((d) => d.floorsUp),
    intensityMinutes: block(intensityOf),
    trainingSeconds: { now: trainNow, before: trainBefore, beforeFull: sum(beforeActsFull, (a) => a.seconds), pct: pct(trainNow, trainBefore) },
    workouts: { now: curActs.length, before: beforeActs.length, beforeFull: beforeActsFull.length, diff: curActs.length - beforeActs.length },
    restingHrAvg: { now: hrNow, before: hrBefore, diff: hrNow !== null && hrBefore !== null ? hrNow - hrBefore : null },
  };
}

/** Days in a row with the step goal met / with a workout. Today counts once it is met. */
function streaksView(allDays, acts, today, yearStart) {
  const byDate = new Map(allDays.map((d) => [d.date, d]));
  const workoutDays = new Set(acts.map((a) => a.date).filter(Boolean));
  const first = allDays[0]?.date ?? today;
  const run = (test) => {
    let current = 0;
    for (let d = addDays(today, -1); toUtc(d) >= toUtc(first) && test(d); d = addDays(d, -1)) current++;
    if (test(today)) current++;
    let longest = 0, longestEnd = null, cur = 0;
    for (const day of allDays) {
      if (toUtc(day.date) < toUtc(yearStart)) continue;
      if (test(day.date)) {
        cur++;
        if (cur > longest) { longest = cur; longestEnd = day.date; }
      } else cur = 0;
    }
    return { current, longest, longestEnd };
  };
  return {
    stepGoal: run((d) => { const day = byDate.get(d); return !!day && goalMet(day); }),
    workouts: run((d) => workoutDays.has(d)),
  };
}

/** Red alert: resting pulse 10 % above the month average, Body Battery under 20, no sync for 24 hours. */
function alertsView(todayDay, monthHrAvg, lastSyncAt, nowMs, { provisional = false, yesterday = null } = {}) {
  const list = [];
  // Early in a day without a recorded night, Garmin's resting pulse is only the lowest value so far
  // and often far too high; then the last finished day speaks instead.
  const source = provisional && yesterday && num(yesterday.restingHr) !== null ? yesterday : todayDay;
  const hr = source.restingHr;
  if (num(hr) !== null && num(monthHrAvg) && hr >= monthHrAvg * 1.1) {
    const when = source === todayDay ? '' : ' YESTERDAY';
    list.push({ key: 'resting-hr', text: `RESTING PULSE${when} ${hr} · ${Math.round(((hr - monthHrAvg) / monthHrAvg) * 100)} % ABOVE YOUR MONTH AVERAGE OF ${monthHrAvg}` });
  }
  const bb = todayDay.bodyBattery?.latest;
  if (num(bb) !== null && bb < 20) list.push({ key: 'body-battery', text: `BODY BATTERY ${bb} · TIME TO RECHARGE` });
  const syncMs = lastSyncAt ? Date.parse(lastSyncAt) : NaN;
  if (Number.isFinite(syncMs) && nowMs - syncMs >= 24 * 3600_000) {
    list.push({ key: 'no-sync', text: `NO WATCH SYNC FOR ${Math.floor((nowMs - syncMs) / 3600_000)} HOURS` });
  }
  return list;
}

/** The board's own reading of Garmin's per-workout training load. */
export function trainingView(acts, today) {
  const from7 = addDays(today, -6);
  const from28 = addDays(today, -27);
  const within = (from) => acts.filter((a) => a.date && a.date >= from && a.date <= today);
  const acute = round1(sum(within(from7), (a) => a.load));
  const chronic = round1(sum(within(from28), (a) => a.load) / 4);
  const ratio = chronic > 0 ? round2(acute / chronic) : null;
  let status = 'NO DATA';
  if (ratio !== null) status = ratio < 0.8 ? 'RECOVERY' : ratio <= 1.0 ? 'MAINTAINING' : ratio <= 1.3 ? 'PRODUCTIVE' : 'OVERREACHING';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    days.push({ date, load: round1(sum(acts.filter((a) => a.date === date), (a) => a.load)) });
  }
  return { acute, chronic, ratio, status, days };
}

/** Seconds in each heart-rate zone this week; when the week has no zone time yet, the last 7 days instead. */
function zonesView(weekActs, zonesRaw, { acts = weekActs, today = null, weekStart: wStart = null } = {}) {
  const secondsOf = (list) => [0, 1, 2, 3, 4].map((i) => Math.round(sum(list, (a) => a.zones?.[i])));
  let secondsInZone = secondsOf(weekActs);
  let period = 'week', since = wStart;
  if (today && secondsInZone.every((v) => v === 0)) {
    const from = addDays(today, -6);
    const last7 = acts.filter((a) => a.date && a.date >= from && a.date <= today);
    const alt = secondsOf(last7);
    if (alt.some((v) => v > 0)) { secondsInZone = alt; period = 'last7'; since = from; }
  }
  const list = Array.isArray(zonesRaw) ? zonesRaw : (zonesRaw && typeof zonesRaw === 'object' ? [zonesRaw] : []);
  const z = list.find((x) => x?.sport === 'DEFAULT') ?? list[0] ?? null;
  return {
    period,
    since,
    secondsInZone,
    total: secondsInZone.reduce((a, b) => a + b, 0),
    floors: z ? [1, 2, 3, 4, 5].map((n) => pos(z[`zone${n}Floor`])) : [],
    maxHr: pos(z?.maxHeartRateUsed),
  };
}

/** Today's steps against the same weekday four weeks ago. */
function stepsCompareView(byDate, today) {
  const date = addDays(today, -28);
  const then = byDate.get(date);
  const steps = then?.hasData ? num(then.steps) : null;
  const todaySteps = num(byDate.get(today)?.steps) ?? 0;
  if (steps === null) return { date, steps: null, delta: null, pct: null };
  return { date, steps, delta: todaySteps - steps, pct: steps > 0 ? Math.round(((todaySteps - steps) / steps) * 100) : null };
}

const trendOf = (value, prev) => (num(value) === null || num(prev) === null ? null : value > prev ? 'up' : value < prev ? 'down' : 'flat');

/** VO2 max from the latest run or ride that estimated it; fitness age from Garmin. */
function fitnessView(acts, fitnessRaw) {
  const withVo2 = acts.filter((a) => num(a.vo2max) !== null).sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const latest = withVo2[0] ?? null;
  const earlierOne = latest ? withVo2.find((a) => a.vo2max !== latest.vo2max) ?? null : null;
  const fa = round1(fitnessRaw?.fitnessAge);
  const faPrev = round1(fitnessRaw?.previousFitnessAge);
  return {
    vo2max: { value: latest?.vo2max ?? null, date: latest?.date ?? null, prev: earlierOne?.vo2max ?? null, trend: trendOf(latest?.vo2max, earlierOne?.vo2max) },
    fitnessAge: { value: fa, prev: faPrev, chronological: round(fitnessRaw?.chronologicalAge), trend: trendOf(fa, faPrev) },
  };
}

/** Twelve month tiles for the year. */
function yearView(allDays, acts, year, today) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${pad2(m)}`;
    const days = allDays.filter(inMonth(ym));
    const finished = days.filter((d) => d.date !== today && d.hasData);
    const monthActs = acts.filter(inMonth(ym));
    months.push({
      ym,
      steps: sum(days, (d) => d.steps),
      workouts: monthActs.length,
      trainingSeconds: sum(monthActs, (a) => a.seconds),
      restingHrAvg: stats(finished.map((d) => d.restingHr)).avg,
      stepGoalDays: days.filter(goalMet).length,
      daysWithData: days.filter((d) => d.hasData).length,
    });
  }
  return { year, months };
}

export function travelView(stored, allDays, today) {
  if (!stored?.since) return null;
  return {
    since: stored.since,
    zone: stored.zone,
    days: Math.max(1, daysBetween(stored.since, today) + 1),
    distanceM: sum(allDays.filter((d) => d.date >= stored.since), (d) => d.distanceM),
  };
}

// ---------- the board ----------

/**
 * Builds the whole board in one go.
 * The daily summaries are the heart of it: if Garmin refuses those, the call fails.
 * Every other part falls back to "nothing" and leaves a warning.
 */
export async function buildBoard(client, { today = todayLocal(), now = () => Date.now(), storeDir, store, homeZone = HOME_ZONE } = {}) {
  const warnings = [];
  const side = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      warnings.push(`${label}: ${err?.message || String(err)}`);
      return fallback;
    }
  };
  const st = store ?? new BoardStore(storeDir);
  const ym = today.slice(0, 7);
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const mStart = monthStart(today);
  const wStart = weekStart(today);
  const rangeStart = earlier(earlier(yearStart, `${prevMonth(ym)}-01`), wStart);

  const { all: allDays, byDate } = await fetchDays(client, rangeStart, today);

  const [activitiesRaw, sleepRaw, nightsRaw, hrvRaw, weightRaw, weightGoalRaw, fitnessRaw, zonesRaw, bbRaw, dailyRaw, token, settings, travelStored, log] = await Promise.all([
    side('workouts', () => fetchActivities(client, rangeStart, today), []),
    side('sleep', () => client.get('/sleep-service/sleep/dailySleep', { date: today }), null),
    side('sleep nights', () => client.get('/sleep-service/sleep/dailySleepSummariesByDate', { startDate: addDays(today, -6), endDate: today }), null),
    side('HRV', () => client.get(`/hrv-service/hrv/${today}`), null),
    side('weight', () => client.get(`/weight-service/weight/range/${addDays(today, -90)}/${today}`, { includeAll: true }), null),
    side('weight goal', () => client.get(`/goal-service/goal/user/effective/weightgoal/${addDays(today, -365)}/${today}`), null),
    side('fitness age', () => client.get(`/fitnessage-service/fitnessage/v2/${today}`), null),
    side('heart-rate zones', () => client.get('/biometric-service/heartRateZones/v2'), null),
    side('Body Battery', () => client.get('/wellness-service/wellness/bodyBattery/reports/daily', { startDate: today, endDate: today }), null),
    side('last sync', () => client.get('/usersummary-service/usersummary/daily', { calendarDate: today }), null),
    side('link', () => client.tokenInfo?.(), null),
    st.settings().catch(() => ({ targets: { ...DEFAULT_TARGETS }, accessCode: '' })),
    st.travel().catch(() => null),
    st.log(ym).catch(() => ({})),
  ]);

  const acts = (Array.isArray(activitiesRaw) ? activitiesRaw : []).map(activityView)
    .sort((a, b) => String(b.start ?? '').localeCompare(String(a.start ?? '')));
  const monthActs = acts.filter(inMonth(ym));
  const weekActs = acts.filter((a) => a.date && a.date >= wStart && a.date <= today);
  const weekDays = allDays.filter((d) => toUtc(d.date) >= toUtc(wStart));
  const todayDay = byDate.get(today) ?? emptyDay(today);
  const month = monthView(allDays, ym, today);
  const weeklyGoal = todayDay.intensityWeeklyGoal
    ?? allDays.filter(inMonth(ym)).map((d) => d.intensityWeeklyGoal).find((g) => g !== null)
    ?? null;
  const lastSyncMs = parseGmt(dailyRaw?.lastSyncTimestampGMT);
  const lastSyncAt = lastSyncMs === null ? null : new Date(lastSyncMs).toISOString();
  const weightTrend = weightTrendView(weightRaw, weightGoalRaw);

  const board = {
    ok: true,
    version: VERSION,
    generatedAt: new Date(now()).toISOString(),
    date: today,
    monthStart: mStart,
    weekStart: wStart,
    homeZone,
    link: {
      ok: true,
      tokenExpiresAt: num(token?.expiresAt) ? new Date(token.expiresAt).toISOString() : null,
    },
    today: { ...strip(todayDay), stepsCompare: stepsCompareView(byDate, today) },
    month,
    week: {
      start: wStart,
      intensityMinutes: sum(weekDays, intensityOf),
      goal: weeklyGoal,
    },
    activities: activitiesView(monthActs),
    sleep: sleepView(sleepRaw),
    hrv: hrvView(hrvRaw),
    weight: weightView(weightRaw),
    compare: compareView(allDays, acts, ym, today),
    streaks: streaksView(allDays, acts, today, yearStart),
    alerts: alertsView(todayDay, month.restingHrAvg, lastSyncAt, now(), {
      provisional: num(dailyRaw?.durationInMilliseconds) !== null && dailyRaw.durationInMilliseconds < 12 * 3600_000 && !(pos(dailyRaw?.sleepingSeconds) > 0),
      yesterday: byDate.get(addDays(today, -1)) ?? null,
    }),
    training: trainingView(acts, today),
    zones: zonesView(weekActs, zonesRaw, { acts, today, weekStart: wStart }),
    fitness: fitnessView(acts, fitnessRaw),
    bodyBatteryCurve: bodyBatteryCurveView(bbRaw, today),
    sleepDebt: sleepDebtView(nightsRaw, today),
    weightTrend,
    year: yearView(allDays, acts, year, today),
    travel: travelView(travelStored, allDays, today),
    targets: { ...settings.targets },
    log,
    lastSyncAt,
    warnings,
  };
  // Kept for the report writer; not part of the JSON.
  Object.defineProperty(board, 'context', { value: { allDays, acts, weightTrend, weeklyGoal, nights: board.sleepDebt.nights }, enumerable: false });
  return board;
}

/** One past (or the current) month: days, totals, workouts, the comparison and the log. */
export async function buildMonth(client, ym, { today = todayLocal(), storeDir, store } = {}) {
  if (!isYm(ym)) throw new RangeError('The month must look like YYYY-MM.');
  if (toUtc(`${ym}-01`) > toUtc(today)) throw new RangeError('That month has not started yet.');
  const st = store ?? new BoardStore(storeDir);
  const start = `${prevMonth(ym)}-01`;
  const end = earlier(monthEnd(ym), today);
  const { all: allDays } = await fetchDays(client, start, end);
  const actsRaw = await fetchActivities(client, `${ym}-01`, end);
  const acts = actsRaw.map(activityView).sort((a, b) => String(b.start ?? '').localeCompare(String(a.start ?? '')));
  const log = await st.log(ym).catch(() => ({}));
  return {
    ok: true,
    ym,
    month: monthView(allDays, ym, today),
    activities: activitiesView(acts.filter(inMonth(ym))),
    compare: compareView(allDays, acts, ym, today),
    log,
  };
}

// ---------- the Monday / month report ----------

const fmtInt = (n) => (num(n) === null ? '—' : Math.round(n).toLocaleString('sv-SE'));
const fmtDur = (s) => {
  if (!num(s)) return '0 min';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${pad2(m)} min` : `${m} min`;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const TYPE_WORDS = {
  running: ['run', 'runs'], treadmill_running: ['treadmill run', 'treadmill runs'], trail_running: ['trail run', 'trail runs'],
  hiking: ['hike', 'hikes'], walking: ['walk', 'walks'], cycling: ['ride', 'rides'], indoor_cycling: ['indoor ride', 'indoor rides'],
  strength_training: ['strength session', 'strength sessions'], lap_swimming: ['swim', 'swims'], open_water_swimming: ['open-water swim', 'open-water swims'],
  swimming: ['swim', 'swims'], yoga: ['yoga session', 'yoga sessions'], indoor_cardio: ['cardio session', 'cardio sessions'], cardio: ['cardio session', 'cardio sessions'],
};
const typeWords = (type, n) => {
  const w = TYPE_WORDS[type] ?? [String(type).replace(/_/g, ' '), String(type).replace(/_/g, ' ') + 's'];
  return plural(n, w[0], w[1]);
};
const longDate = (iso) => `${dayOfMonth(iso)} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]}`;

/** The previous week (Monday–Sunday) or the previous month in plain words. */
export function reportText(kind, board, today = board.date) {
  const ctx = board.context ?? { allDays: [], acts: [], weightTrend: { points: [] }, weeklyGoal: null };
  let start, end, title, goalMinutes;
  if (kind === 'month') {
    const prev = prevMonth(today.slice(0, 7));
    start = `${prev}-01`;
    end = monthEnd(prev);
    title = `${MONTH_NAMES[Number(prev.slice(5)) - 1]} ${prev.slice(0, 4)}`;
    goalMinutes = ctx.weeklyGoal ? Math.round((ctx.weeklyGoal * daysInMonth(prev)) / 7) : null;
  } else {
    const thisMonday = weekStart(today);
    start = addDays(thisMonday, -7);
    end = addDays(thisMonday, -1);
    title = `Week ${isoWeek(start)} · ${longDate(start)} – ${longDate(end)} ${end.slice(0, 4)}`;
    goalMinutes = ctx.weeklyGoal ?? null;
  }
  const days = ctx.allDays.filter((d) => d.date >= start && d.date <= end);
  const withData = days.filter((d) => d.hasData);
  const acts = ctx.acts.filter((a) => a.date && a.date >= start && a.date <= end);
  const lines = [];
  const steps = sum(days, (d) => d.steps);
  lines.push(`Steps: ${fmtInt(steps)} in total, ${fmtInt(withData.length ? steps / withData.length : 0)} a day. Step goal met on ${days.filter(goalMet).length} of ${days.length} days.`);
  if (acts.length) {
    const byType = {};
    for (const a of acts) byType[a.type] = (byType[a.type] ?? 0) + 1;
    const parts = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => typeWords(t, n));
    lines.push(`Workouts: ${acts.length}, ${fmtDur(sum(acts, (a) => a.seconds))} in total: ${parts.join(', ')}. Distance ${fmtInt(sum(acts, (a) => a.distanceM) / 1000)} km, ${fmtInt(sum(acts, (a) => a.elevationGain))} m climbed.`);
  } else {
    lines.push('Workouts: none recorded.');
  }
  const hr = stats(withData.map((d) => d.restingHr));
  lines.push(hr.avg !== null ? `Resting pulse: ${hr.avg} on average (${hr.min}–${hr.max}).` : 'Resting pulse: nothing recorded.');
  const im = sum(days, intensityOf);
  lines.push(goalMinutes ? `Intensity minutes: ${fmtInt(im)} of your ${fmtInt(goalMinutes)} goal.` : `Intensity minutes: ${fmtInt(im)}.`);
  const bbLow = stats(withData.map((d) => d.bodyBattery?.min)).min;
  const bbHigh = stats(withData.map((d) => d.bodyBattery?.max)).max;
  if (bbLow !== null) lines.push(`Body Battery: lowest ${bbLow}, highest ${bbHigh}.`);
  const weighIns = (ctx.weightTrend?.points ?? []).filter((p) => p.date >= start && p.date <= end);
  if (weighIns.length) {
    const last = weighIns.at(-1), first = weighIns[0];
    const delta = round1(last.kg - first.kg);
    lines.push(`Weight: ${last.kg.toLocaleString('sv-SE')} kg on ${longDate(last.date)}${weighIns.length > 1 && delta ? `, ${delta > 0 ? '+' : ''}${delta.toLocaleString('sv-SE')} kg since ${longDate(first.date)}` : ''}.`);
  } else {
    lines.push('Weight: no weigh-in.');
  }
  const nights = (ctx.nights ?? []).filter((n) => n.recorded && n.date >= start && n.date <= end);
  const sleepAvgMin = nights.length ? Math.round(sum(nights, (n) => n.sleptMin) / nights.length) : null;
  lines.push(sleepAvgMin !== null ? `Sleep: ${fmtDur(sleepAvgMin * 60)} a night on average over ${plural(nights.length, 'recorded night', 'recorded nights')}.` : 'Sleep: no nights recorded.');
  lines.push(`Days with data: ${withData.length} of ${days.length}.`);
  const summary = {
    start, end,
    steps, stepGoalDays: days.filter(goalMet).length, days: days.length, daysWithData: withData.length,
    workouts: acts.length, trainingSeconds: sum(acts, (a) => a.seconds), distanceKm: round1(sum(acts, (a) => a.distanceM) / 1000),
    restingHrAvg: hr.avg, intensityMinutes: im, intensityGoal: goalMinutes, sleepAvgMin,
  };
  return { kind, title, text: lines.join('\n'), summary };
}
