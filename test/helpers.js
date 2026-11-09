// Shared test helpers: a fake fetch and a fake client.

export function jsonResponse(status, body, headers = {}) {
  const text = body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    async text() { return text; },
    async arrayBuffer() { return new TextEncoder().encode(text).buffer; },
  };
}

export function binaryResponse(status, bytes, headers = {}) {
  const buf = Buffer.from(bytes);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    async text() { return buf.toString('utf8'); },
    async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); },
  };
}

/** handler(url, init, callIndex) -> response. Records every call. */
export function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {} };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  fn.calls = calls;
  return fn;
}

/** Fake client: respond(path, query) -> data. Records calls. */
export function fakeClient(respond = async () => ({}), extra = {}) {
  const calls = [];
  const client = {
    calls,
    async get(path, query = {}) {
      calls.push({ path, query });
      return respond(path, query, calls.length - 1);
    },
    async getBinary(path, query = {}) {
      calls.push({ path, query, binary: true });
      return { buffer: Buffer.from('FITDATA'), contentType: 'application/octet-stream', filename: 'a.fit' };
    },
    async tokenInfo() { return { token: 't', expiresAt: Date.parse('2026-11-02T12:00:00Z') }; },
    ...extra,
  };
  return client;
}

export function byTool(tools, name) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} missing`);
  return t;
}

export const TOOL_NAMES = [
  'garmin_status', 'garmin_profile', 'garmin_activities', 'garmin_activity', 'garmin_activity_file',
  'garmin_day', 'garmin_days', 'garmin_sleep', 'garmin_hrv', 'garmin_stress', 'garmin_steps',
  'garmin_body_battery', 'garmin_heart_rate', 'garmin_spo2', 'garmin_weight', 'garmin_hydration',
  'garmin_fitness_age', 'garmin_heart_rate_zones', 'garmin_nutrition', 'garmin_wellness_activities',
  'garmin_menstrual_cycle', 'garmin_raw',
];
