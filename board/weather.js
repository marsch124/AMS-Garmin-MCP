// AMS Garmin Board — weather and sun times from Open-Meteo (free, no key),
// for the place of the latest workout, home, or the browser's location.

export const HOME_PLACE = Object.freeze({ lat: 58.5877, lon: 16.1924, name: 'NORRKÖPING', source: 'home' });

const WMO = [
  [0, 'CLEAR'], [1, 'MAINLY CLEAR'], [2, 'PARTLY CLOUDY'], [3, 'OVERCAST'],
  [45, 'FOG'], [48, 'FOG'],
  [51, 'DRIZZLE'], [53, 'DRIZZLE'], [55, 'DRIZZLE'], [56, 'DRIZZLE'], [57, 'DRIZZLE'],
  [61, 'RAIN'], [63, 'RAIN'], [65, 'RAIN'], [66, 'RAIN'], [67, 'RAIN'],
  [71, 'SNOW'], [73, 'SNOW'], [75, 'SNOW'], [77, 'SNOW'],
  [80, 'SHOWERS'], [81, 'SHOWERS'], [82, 'SHOWERS'], [85, 'SNOW SHOWERS'], [86, 'SNOW SHOWERS'],
  [95, 'THUNDERSTORM'], [96, 'THUNDERSTORM'], [99, 'THUNDERSTORM'],
];
const WMO_TEXT = new Map(WMO);

/** Plain words for a WMO weather code. */
export function weatherText(code) {
  if (!Number.isFinite(code)) return '—';
  if (WMO_TEXT.has(code)) return WMO_TEXT.get(code);
  if (code >= 95) return 'THUNDERSTORM';
  if (code >= 80) return 'SHOWERS';
  if (code >= 71) return 'SNOW';
  if (code >= 61) return 'RAIN';
  if (code >= 51) return 'DRIZZLE';
  if (code >= 45) return 'FOG';
  return 'CLOUDY';
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = (v, d = 0) => (num(v) === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Turns Open-Meteo's answer into the board's weather block. */
export function weatherView(raw, { hours = 12 } = {}) {
  const cur = raw?.current || {};
  const h = raw?.hourly || {};
  const times = Array.isArray(h.time) ? h.time : [];
  const nowTime = typeof cur.time === 'string' ? cur.time : null;
  let from = nowTime ? times.findIndex((t) => t >= nowTime.slice(0, 13)) : 0;
  if (from < 0) from = 0;
  const list = [];
  for (let i = from; i < times.length && list.length < hours; i++) {
    list.push({
      time: times[i],
      tempC: round(h.temperature_2m?.[i]),
      rainPct: round(h.precipitation_probability?.[i]),
      windKmh: round(h.wind_speed_10m?.[i]),
      code: num(h.weather_code?.[i]),
      text: weatherText(num(h.weather_code?.[i])),
    });
  }
  const d = raw?.daily || {};
  return {
    now: {
      tempC: round(cur.temperature_2m, 1),
      windKmh: round(cur.wind_speed_10m),
      precipMm: round(cur.precipitation, 1),
      code: num(cur.weather_code),
      text: weatherText(num(cur.weather_code)),
      time: nowTime,
    },
    hours: list,
    sun: {
      sunrise: Array.isArray(d.sunrise) ? d.sunrise[0] ?? null : null,
      sunset: Array.isArray(d.sunset) ? d.sunset[0] ?? null : null,
    },
    zone: typeof raw?.timezone === 'string' ? raw.timezone : null,
  };
}

/**
 * A small weather service with a 15-minute memory per place (rounded to 2 decimals).
 * fetchFn is injectable for tests.
 */
export function createWeather({ fetchFn = globalThis.fetch, now = () => Date.now(), cacheMs = 15 * 60 * 1000, hours = 12 } = {}) {
  const cache = new Map(); // key -> { at, body }
  return {
    async forecast(place) {
      const lat = round(place?.lat, 2);
      const lon = round(place?.lon, 2);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new RangeError('The weather needs a latitude and a longitude.');
      }
      const key = `${lat},${lon}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < cacheMs) return hit.body;
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set('current', 'temperature_2m,wind_speed_10m,precipitation,weather_code');
      url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code');
      url.searchParams.set('daily', 'sunrise,sunset');
      url.searchParams.set('forecast_days', '2');
      url.searchParams.set('timezone', 'auto');
      const res = await fetchFn(url.toString(), { headers: { accept: 'application/json' } });
      if (!res || !res.ok) throw new Error(`The weather service answered ${res?.status ?? 'nothing'}.`);
      const raw = typeof res.json === 'function' ? await res.json() : JSON.parse(await res.text());
      const body = weatherView(raw, { hours });
      cache.set(key, { at: now(), body });
      return body;
    },
  };
}
