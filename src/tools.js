// AMS Garmin — the tools Claude can call, one per kind of Garmin data.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GarminError, KEY_FILE } from './garmin-client.js';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');
export { VERSION };

// ---------- small helpers ----------

export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function todayLocal(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function requireDate(value, label = 'date') {
  if (!isIsoDate(value)) {
    throw new GarminError(`The ${label} must be written as YYYY-MM-DD, for example 2026-11-09 (got "${value}").`, { code: 'BAD_DATE' });
  }
  return value;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const toUtc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Splits an inclusive date range into chunks of at most maxDays days each. */
export function splitRange(startDate, endDate, maxDays) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new GarminError(`Dates must be written as YYYY-MM-DD (got "${startDate}" and "${endDate}").`, { code: 'BAD_RANGE' });
  }
  if (daysBetween(startDate, endDate) < 0) {
    throw new GarminError(`The end date ${endDate} is before the start date ${startDate}.`, { code: 'BAD_RANGE' });
  }
  const chunks = [];
  let from = startDate;
  while (daysBetween(from, endDate) >= 0) {
    const to = addDays(from, maxDays - 1);
    const chunkEnd = daysBetween(to, endDate) > 0 ? to : endDate;
    chunks.push({ startDate: from, endDate: chunkEnd });
    from = addDays(chunkEnd, 1);
  }
  return chunks;
}

/** Deep copy without null/undefined values, empty arrays and empty objects. Keeps 0 and false. */
export function compact(value) {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const c = compact(v);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined) return undefined;
  return value;
}

function finish(value) {
  const c = compact(value);
  return c === undefined ? (Array.isArray(value) ? [] : {}) : c;
}

function stripKeys(value, keys) {
  if (Array.isArray(value)) return value.map((v) => stripKeys(v, keys));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (keys.includes(k)) continue;
      out[k] = stripKeys(v, keys);
    }
    return out;
  }
  return value;
}

const ACTIVITY_FIELDS = [
  'activityId', 'activityName', 'startTimeLocal', 'duration', 'movingDuration', 'distance', 'calories',
  'averageHR', 'maxHR', 'elevationGain', 'averageSpeed', 'maxSpeed', 'steps',
  'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel', 'activityTrainingLoad',
  'vO2MaxValue', 'avgPower', 'normPower', 'totalSets', 'totalReps', 'summarizedExerciseSets',
  'moderateIntensityMinutes', 'vigorousIntensityMinutes', 'locationName', 'isFavorite', 'isPR',
];

/** The short view of one activity for lists. */
export function trimActivity(a) {
  if (!a || typeof a !== 'object') return a;
  const out = {};
  for (const key of ACTIVITY_FIELDS) if (a[key] !== undefined) out[key] = a[key];
  if (a.activityType) out.activityType = a.activityType.typeKey ?? a.activityType;
  if (a.eventType) out.eventType = a.eventType.typeKey ?? a.eventType;
  return finish(out);
}

async function fetchChunks(client, startDate, endDate, maxDays, call) {
  requireDate(startDate, 'startDate');
  requireDate(endDate, 'endDate');
  const results = [];
  for (const chunk of splitRange(startDate, endDate, maxDays)) {
    const part = await call(chunk);
    if (Array.isArray(part)) results.push(...part);
    else if (part !== null && part !== undefined) results.push(part);
  }
  return results;
}

// ---------- the 26 Garmin paths the personal API offers ----------

export const SPEC_PATHS = [
  '/activity-service/activity/{activityId}',
  '/activity-service/activity/{activityId}/workouts',
  '/activitylist-service/activities/search/activities',
  '/biometric-service/heartRateZones/v2',
  '/download-service/files/activity/{activityId}',
  '/fitnessage-service/fitnessage/v2/{calendarDate}',
  '/goal-service/goal/user/effective/weightgoal/{startDate}/{endDate}',
  '/hrv-service/hrv/{calendarDate}',
  '/hrv-service/hrv/daily/{fromDate}/{toDate}',
  '/nutrition-service/food/logs/{date}',
  '/periodichealth-service/menstrualcycle/summary/{calendarDate}',
  '/periodichealth-service/menstrualcycle/dayview/{calendarDate}',
  '/sleep-service/sleep/dailySleep',
  '/sleep-service/sleep/dailySleepSummariesByDate',
  '/userprofile-service/userprofile/settings',
  '/usersummary-service/stats/hydration/daily/{startDate}/{endDate}',
  '/usersummary-service/stats/steps/daily/{startDate}/{endDate}',
  '/usersummary-service/stats/stress/daily/{startDate}/{endDate}',
  '/usersummary-service/usersummary/daily',
  '/usersummary-service/v2/dailysummaries',
  '/weight-service/weight/all/{startDate}/{endDate}',
  '/weight-service/weight/range/{startDate}/{endDate}',
  '/wellness-service/wellness/bodyBattery/reports/daily',
  '/wellness-service/wellness/daily/spo2acclimation/{calendarDate}',
  '/wellness-service/wellness/dailyHeartRate',
  '/wellnessactivity-service/activity/summary/range/{fromDate}/{untilDate}',
];

const SPEC_MATCHERS = SPEC_PATHS.map((p) => new RegExp('^' + p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+') + '/?$'));

export function isSpecPath(path) {
  if (typeof path !== 'string') return false;
  const clean = path.split('?')[0];
  return SPEC_MATCHERS.some((re) => re.test(clean));
}

// ---------- schemas ----------

const date = z.string().describe('A day, written YYYY-MM-DD.');
const optionalDate = date.optional();
const rangeShape = {
  startDate: date.describe('First day, YYYY-MM-DD.'),
  endDate: date.describe('Last day, YYYY-MM-DD (inclusive).'),
};

const PROFILE_PATH = '/userprofile-service/userprofile/settings';

// ---------- the tools ----------

export const TOOLS = [
  {
    name: 'garmin_status',
    title: 'Garmin connection check',
    description: 'Checks that the Garmin key works. Returns the account display name, units, time zone, where the key file lives and when the cached access token expires. Call this first when something seems off.',
    inputSchema: {},
    async handler(_args, client) {
      const settings = await client.get(PROFILE_PATH);
      const info = typeof client.tokenInfo === 'function' ? await client.tokenInfo() : null;
      return finish({
        connected: true,
        displayName: settings?.displayName,
        measurementSystem: settings?.measurementSystem,
        timeZone: settings?.timeZone,
        keyFile: KEY_FILE,
        tokenExpiresAt: info?.expiresAt ? new Date(info.expiresAt).toISOString() : undefined,
        version: VERSION,
      });
    },
  },
  {
    name: 'garmin_profile',
    title: 'Garmin profile settings',
    description: 'The Garmin Connect profile settings: display name, units (metric/statute), locale, time zone, first day of week, hydration containers, training days.',
    inputSchema: {},
    async handler(_args, client) {
      return finish(await client.get(PROFILE_PATH));
    },
  },
  {
    name: 'garmin_activities',
    title: 'List workouts',
    description: 'Lists workouts (activities) newest first, with the key numbers of each: type, start time, duration, distance, calories, heart rate, training effect, exercise sets for strength training. Filter by date range, type (running, cycling, strength_training, walking, swimming, hiking, indoor_cardio …) or a search word. Use start to page through more. Set full=true for every field Garmin has.',
    inputSchema: {
      startDate: optionalDate.describe('Earliest start day, YYYY-MM-DD.'),
      endDate: optionalDate.describe('Latest start day, YYYY-MM-DD.'),
      activityType: z.string().optional().describe('Garmin type key, e.g. running, cycling, strength_training, walking, swimming.'),
      search: z.string().optional().describe('Text to look for in names and descriptions.'),
      limit: z.number().int().min(1).max(99).optional().describe('How many to return, 1–99. Default 20.'),
      start: z.number().int().min(0).optional().describe('How many to skip (paging). Default 0.'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('desc = newest first (default).'),
      full: z.boolean().optional().describe('true = every field Garmin has, not just the short view.'),
    },
    async handler(args, client) {
      if (args.startDate) requireDate(args.startDate, 'startDate');
      if (args.endDate) requireDate(args.endDate, 'endDate');
      const query = {
        start: args.start ?? 0,
        limit: args.limit ?? 20,
        sortOrder: args.sortOrder ?? 'desc',
        startDate: args.startDate,
        endDate: args.endDate,
        activityType: args.activityType,
        search: args.search,
      };
      const list = await client.get(SPEC_PATHS[2], query);
      const items = Array.isArray(list) ? list : [];
      return args.full ? finish(items) : items.map(trimActivity);
    },
  },
  {
    name: 'garmin_activity',
    title: 'One workout in detail',
    description: 'Everything Garmin stores about one workout: summary numbers, splits/laps, device, location. includeWorkouts adds the planned workout steps that were followed (sets, reps, targets).',
    inputSchema: {
      activityId: z.number().int().describe('The activityId from garmin_activities.'),
      includeWorkouts: z.boolean().optional().describe('Also fetch the workout steps performed.'),
      full: z.boolean().optional().describe('true = keep empty fields too.'),
    },
    async handler(args, client) {
      const detail = await client.get(`/activity-service/activity/${args.activityId}`);
      let result = detail && typeof detail === 'object' ? { ...detail } : { detail };
      if (args.includeWorkouts) {
        result.workouts = await client.get(`/activity-service/activity/${args.activityId}/workouts`);
      }
      return args.full ? result : finish(result);
    },
  },
  {
    name: 'garmin_activity_file',
    title: 'Download the original workout file',
    description: 'Saves the original recording of one workout (a zip holding the .FIT file) to a folder on this Mac. Default folder: ~/Downloads/Garmin.',
    inputSchema: {
      activityId: z.number().int().describe('The activityId from garmin_activities.'),
      folder: z.string().optional().describe('Folder to save into. Default ~/Downloads/Garmin.'),
    },
    async handler(args, client) {
      const folder = args.folder || join(homedir(), 'Downloads', 'Garmin');
      const file = await client.getBinary(`/download-service/files/activity/${args.activityId}`);
      await mkdir(folder, { recursive: true });
      const name = file.filename || `${args.activityId}.zip`;
      const path = join(folder, name);
      await writeFile(path, file.buffer);
      return { path, bytes: file.buffer.length, contentType: file.contentType || undefined };
    },
  },
  {
    name: 'garmin_day',
    title: 'One day in summary',
    description: 'The daily summary for one day: steps, distance, calories, floors, intensity minutes, heart rate (resting, min, max), stress, Body Battery, SpO2, respiration, hydration and goals. Default: today.',
    inputSchema: {
      date: optionalDate.describe('The day, YYYY-MM-DD. Default today.'),
      full: z.boolean().optional().describe('true = every field Garmin has.'),
    },
    async handler(args, client) {
      const day = requireDate(args.date ?? todayLocal());
      const data = await client.get('/usersummary-service/usersummary/daily', { calendarDate: day });
      if (args.full) return finish(data);
      return finish(stripKeys(data, ['bodyBatteryActivityEventList', 'uuid', 'userProfileId', 'userDailySummaryId']));
    },
  },
  {
    name: 'garmin_days',
    title: 'Daily summaries over a period',
    description: 'One summary per day over a period of up to a year (steps, calories, heart rate, stress, Body Battery, intensity minutes, hydration, respiration, SpO2). Good for trends and averages.',
    inputSchema: { ...rangeShape },
    async handler(args, client) {
      const days = await fetchChunks(client, args.startDate, args.endDate, 365, async (c) => {
        const r = await client.get('/usersummary-service/v2/dailysummaries', { startDate: c.startDate, endDate: c.endDate });
        return Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
      });
      return finish(stripKeys(days, ['uuid', 'userProfilePk']));
    },
  },
  {
    name: 'garmin_sleep',
    title: 'Sleep',
    description: 'Sleep for one night (date = the morning you woke up) with stages, score, SpO2, respiration, HRV and naps; or sleep summaries for a period (startDate + endDate).',
    inputSchema: {
      date: optionalDate.describe('One night, YYYY-MM-DD (the day you woke up). Default today if no range is given.'),
      startDate: optionalDate,
      endDate: optionalDate,
      full: z.boolean().optional().describe('true = keep empty fields too.'),
    },
    async handler(args, client) {
      if (args.startDate || args.endDate) {
        const list = await fetchChunks(client, args.startDate, args.endDate, 31, (c) =>
          client.get('/sleep-service/sleep/dailySleepSummariesByDate', { startDate: c.startDate, endDate: c.endDate }));
        return finish(list);
      }
      const day = requireDate(args.date ?? todayLocal());
      const data = await client.get('/sleep-service/sleep/dailySleep', { date: day });
      return args.full ? data : finish(data);
    },
  },
  {
    name: 'garmin_hrv',
    title: 'Heart rate variability (HRV)',
    description: 'Overnight HRV: for one night (date) the summary with status, baseline and weekly average, or daily summaries over a period (startDate + endDate). includeReadings adds the 5-minute readings of one night.',
    inputSchema: {
      date: optionalDate,
      startDate: optionalDate,
      endDate: optionalDate,
      includeReadings: z.boolean().optional().describe('Add the individual overnight readings (one night only).'),
    },
    async handler(args, client) {
      if (args.startDate || args.endDate) {
        const list = await fetchChunks(client, args.startDate, args.endDate, 31, async (c) => {
          const r = await client.get(`/hrv-service/hrv/daily/${c.startDate}/${c.endDate}`);
          return Array.isArray(r?.hrvSummaries) ? r.hrvSummaries : (Array.isArray(r) ? r : []);
        });
        return finish(list);
      }
      const day = requireDate(args.date ?? todayLocal());
      const data = await client.get(`/hrv-service/hrv/${day}`);
      return finish(args.includeReadings ? data : stripKeys(data, ['hrvReadings']));
    },
  },
  {
    name: 'garmin_stress',
    title: 'Stress by day',
    description: 'Daily stress over a period: average and max stress and time at each level, one entry per day.',
    inputSchema: { ...rangeShape },
    async handler(args, client) {
      const list = await fetchChunks(client, args.startDate, args.endDate, 28, (c) =>
        client.get(`/usersummary-service/stats/stress/daily/${c.startDate}/${c.endDate}`));
      return finish(list);
    },
  },
  {
    name: 'garmin_steps',
    title: 'Steps by day',
    description: 'Daily steps, distance and step goal over a period, one entry per day.',
    inputSchema: { ...rangeShape },
    async handler(args, client) {
      const list = await fetchChunks(client, args.startDate, args.endDate, 28, (c) =>
        client.get(`/usersummary-service/stats/steps/daily/${c.startDate}/${c.endDate}`));
      return finish(list);
    },
  },
  {
    name: 'garmin_body_battery',
    title: 'Body Battery by day',
    description: 'Body Battery per day over a period: charged, drained, feedback and activity events. includeSeries adds the minute-by-minute values.',
    inputSchema: {
      ...rangeShape,
      includeSeries: z.boolean().optional().describe('Add the detailed value series (large).'),
    },
    async handler(args, client) {
      const list = await fetchChunks(client, args.startDate, args.endDate, 31, (c) =>
        client.get('/wellness-service/wellness/bodyBattery/reports/daily', { startDate: c.startDate, endDate: c.endDate }));
      return finish(args.includeSeries ? list : stripKeys(list, ['bodyBatteryValuesArray', 'bodyBatteryValueDescriptorDTOList']));
    },
  },
  {
    name: 'garmin_heart_rate',
    title: 'Heart rate for one day',
    description: 'Heart rate for one day: resting, minimum, maximum and the 7-day resting average. includeSeries adds the readings through the day.',
    inputSchema: {
      date: optionalDate.describe('The day, YYYY-MM-DD. Default today.'),
      includeSeries: z.boolean().optional().describe('Add the readings through the day (large).'),
    },
    async handler(args, client) {
      const day = requireDate(args.date ?? todayLocal());
      const data = await client.get('/wellness-service/wellness/dailyHeartRate', { date: day });
      return finish(args.includeSeries ? data : stripKeys(data, ['heartRateValues', 'heartRateValueDescriptors']));
    },
  },
  {
    name: 'garmin_spo2',
    title: 'Blood oxygen (SpO2) for one day',
    description: 'Pulse-ox readings for one day: average, lowest, latest, during sleep, 7-day average. includeSeries adds the single readings and hourly averages.',
    inputSchema: {
      date: optionalDate.describe('The day, YYYY-MM-DD. Default today.'),
      includeSeries: z.boolean().optional(),
    },
    async handler(args, client) {
      const day = requireDate(args.date ?? todayLocal());
      const data = await client.get(`/wellness-service/wellness/daily/spo2acclimation/${day}`);
      const series = ['spO2SingleValues', 'spO2SingleValuesDescriptorList', 'spO2HourlyAverages', 'spO2HourlyAveragesDescriptorList', 'monitoringEnvironmentValues', 'monitoringEnvironmentValuesDescriptorList'];
      return finish(args.includeSeries ? data : stripKeys(data, series));
    },
  },
  {
    name: 'garmin_weight',
    title: 'Weight',
    description: 'Weight over a period: the latest weight per day, the period average and the neighbouring weigh-ins, plus BMI, body fat, muscle mass when a scale recorded them. includeAll lists every weigh-in; includeGoal adds the weight goal.',
    inputSchema: {
      ...rangeShape,
      includeAll: z.boolean().optional().describe('Every weigh-in of each day, not just the latest.'),
      includeGoal: z.boolean().optional().describe('Also return the weight goal in force.'),
    },
    async handler(args, client) {
      const startDate = requireDate(args.startDate, 'startDate');
      const endDate = requireDate(args.endDate, 'endDate');
      splitRange(startDate, endDate, 100000); // checks the order of the dates
      const data = await client.get(`/weight-service/weight/range/${startDate}/${endDate}`, { includeAll: args.includeAll ?? false });
      const result = data && typeof data === 'object' ? { ...data } : { data };
      if (args.includeGoal) {
        result.goal = await client.get(`/goal-service/goal/user/effective/weightgoal/${startDate}/${endDate}`);
      }
      return finish(result);
    },
  },
  {
    name: 'garmin_hydration',
    title: 'Hydration by day',
    description: 'Water intake per day over a period: amount, goal, sweat loss, intake during activities.',
    inputSchema: { ...rangeShape },
    async handler(args, client) {
      const list = await fetchChunks(client, args.startDate, args.endDate, 31, (c) =>
        client.get(`/usersummary-service/stats/hydration/daily/${c.startDate}/${c.endDate}`));
      return finish(list);
    },
  },
  {
    name: 'garmin_fitness_age',
    title: 'Fitness age',
    description: 'Fitness age as of a day: real age, fitness age, achievable fitness age and the parts it is made of (VO2 max, activity, BMI/body fat, resting heart rate).',
    inputSchema: { date: optionalDate.describe('As of this day, YYYY-MM-DD. Default today.') },
    async handler(args, client) {
      const day = requireDate(args.date ?? todayLocal());
      return finish(await client.get(`/fitnessage-service/fitnessage/v2/${day}`));
    },
  },
  {
    name: 'garmin_heart_rate_zones',
    title: 'Heart rate zones',
    description: 'The heart rate zone settings per sport: zone floors, resting and max heart rate used, training method.',
    inputSchema: {},
    async handler(_args, client) {
      return finish(await client.get('/biometric-service/heartRateZones/v2'));
    },
  },
  {
    name: 'garmin_nutrition',
    title: 'Food log for one day',
    description: 'What was logged as eaten on one day in Garmin Connect, with goals and nutrients. Empty when nothing was logged.',
    inputSchema: { date: optionalDate.describe('The day, YYYY-MM-DD. Default today.') },
    async handler(args, client) {
      const day = requireDate(args.date ?? todayLocal());
      return finish(await client.get(`/nutrition-service/food/logs/${day}`));
    },
  },
  {
    name: 'garmin_wellness_activities',
    title: 'Automatically detected activity',
    description: 'Wellness activities Garmin detected on its own (walks, Move IQ events) over a period, with time in zones.',
    inputSchema: { ...rangeShape },
    async handler(args, client) {
      const list = await fetchChunks(client, args.startDate, args.endDate, 31, (c) =>
        client.get(`/wellnessactivity-service/activity/summary/range/${c.startDate}/${c.endDate}`));
      return finish(list);
    },
  },
  {
    name: 'garmin_menstrual_cycle',
    title: 'Menstrual cycle',
    description: 'Menstrual cycle summary for a day; detailed=true adds the logged symptoms, flow and mood for that day.',
    inputSchema: {
      date: optionalDate.describe('The day, YYYY-MM-DD. Default today.'),
      detailed: z.boolean().optional(),
    },
    async handler(args, client) {
      const day = requireDate(args.date ?? todayLocal());
      const path = args.detailed
        ? `/periodichealth-service/menstrualcycle/dayview/${day}`
        : `/periodichealth-service/menstrualcycle/summary/${day}`;
      return finish(await client.get(path));
    },
  },
  {
    name: 'garmin_raw',
    title: 'Any Garmin personal API call',
    description: 'Calls one of the 26 documented Garmin Personal API paths directly (GET) and returns the answer as-is, only with empty fields removed. For things the other tools do not cover, e.g. /weight-service/weight/all/2026-10-01/2026-10-31.',
    inputSchema: {
      path: z.string().describe('The path, starting with /, with real values in place of {placeholders}.'),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe('Query parameters.'),
    },
    async handler(args, client) {
      if (!isSpecPath(args.path)) {
        throw new GarminError(`"${args.path}" is not one of the paths Garmin's Personal API documents. Allowed: ${SPEC_PATHS.join(', ')}`, { code: 'BAD_PATH' });
      }
      return finish(await client.get(args.path, args.query ?? {}));
    },
  },
];

// ---------- wiring into an MCP server ----------

function errorText(err) {
  if (err instanceof GarminError) return err.message;
  if (err?.name === 'ZodError' || err?.issues) return `The arguments were not right: ${err.message}`;
  return `Something went wrong talking to Garmin: ${err?.message || String(err)}`;
}

export function registerTools(server, client) {
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      async (args) => {
        try {
          const result = await tool.handler(args ?? {}, client);
          return { content: [{ type: 'text', text: JSON.stringify(result ?? null, null, 1) }] };
        } catch (err) {
          return { isError: true, content: [{ type: 'text', text: errorText(err) }] };
        }
      },
    );
  }
  return server;
}

export function createServer(client) {
  const server = new McpServer({ name: 'ams-garmin', version: VERSION });
  registerTools(server, client);
  return server;
}
