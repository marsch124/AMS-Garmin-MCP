// AMS Garmin Board — reads the original workout file (a zip holding a .FIT file)
// and turns it into splits, a heart-rate curve and a GPS trace for the board.
// A small, self-contained decoder: FIT header, definition and data messages,
// little/big endian, compressed-timestamp headers; developer fields are skipped.
// The CRC is not checked (a damaged file simply yields fewer points).

import { inflateRawSync } from 'node:zlib';

// ---------- zip ----------

/** Returns the entries of a zip as { name, data } buffers (stored or deflated). */
export function unzip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const entries = [];
  // Prefer the central directory (it carries sizes even when local headers do not).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd > -1) {
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    for (let n = 0; n < count && p + 46 <= buf.length; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10);
      const compSize = buf.readUInt32LE(p + 20);
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      const localOffset = buf.readUInt32LE(p + 42);
      const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
      const entry = readLocal(buf, localOffset, { method, compSize, name });
      if (entry) entries.push(entry);
      p += 46 + nameLen + extraLen + commentLen;
    }
    if (entries.length) return entries;
  }
  // Fallback: walk the local headers.
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const entry = readLocal(buf, p);
    if (!entry) break;
    entries.push(entry);
    p = entry.end;
  }
  return entries;
}

function readLocal(buf, p, known = {}) {
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) return null;
  const method = known.method ?? buf.readUInt16LE(p + 8);
  const compSize = known.compSize ?? buf.readUInt32LE(p + 18);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const name = known.name ?? buf.toString('utf8', p + 30, p + 30 + nameLen);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + compSize);
  let data;
  try {
    data = method === 8 ? inflateRawSync(raw) : (method === 0 ? Buffer.from(raw) : null);
  } catch {
    data = null;
  }
  if (!data) return null;
  return { name, data, end: start + compSize };
}

// ---------- FIT ----------

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const SEMI = 180 / 2 ** 31;
const BASE_SIZES = { 0x00: 1, 0x01: 1, 0x02: 1, 0x83: 2, 0x84: 2, 0x85: 4, 0x86: 4, 0x07: 1, 0x88: 4, 0x89: 8, 0x0a: 1, 0x8b: 2, 0x8c: 4, 0x0d: 1, 0x8e: 8, 0x8f: 8, 0x90: 8 };

function readValue(buf, pos, baseType, size, little) {
  const r = (fn, bytes) => buf[`${fn}${little ? 'LE' : 'BE'}`](pos);
  switch (baseType) {
    case 0x00: case 0x02: case 0x0a: case 0x0d: return size === 1 ? buf[pos] : null;
    case 0x01: return buf.readInt8(pos);
    case 0x83: return r('readInt16');
    case 0x84: case 0x8b: return r('readUInt16');
    case 0x85: return r('readInt32');
    case 0x86: case 0x8c: return r('readUInt32');
    case 0x88: return r('readFloat');
    case 0x89: return r('readDouble');
    case 0x8e: return Number(little ? buf.readBigInt64LE(pos) : buf.readBigInt64BE(pos));
    case 0x8f: case 0x90: return Number(little ? buf.readBigUInt64LE(pos) : buf.readBigUInt64BE(pos));
    case 0x07: return buf.toString('utf8', pos, pos + size).replace(/\0.*$/s, '');
    default: return null;
  }
}

function isInvalid(value, baseType) {
  if (value === null || value === undefined) return true;
  switch (baseType) {
    case 0x00: case 0x02: case 0x0d: return value === 0xff;
    case 0x01: return value === 0x7f;
    case 0x83: return value === 0x7fff;
    case 0x84: return value === 0xffff;
    case 0x85: return value === 0x7fffffff;
    case 0x86: return value === 0xffffffff;
    case 0x0a: case 0x8b: case 0x8c: case 0x90: return value === 0;
    case 0x88: case 0x89: return !Number.isFinite(value);
    default: return false;
  }
}

/** Decodes every data message into { global, fields: { <defNum>: value } }. */
export function decodeFit(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const messages = [];
  let p = 0;
  while (p + 12 <= buf.length) {
    const headerSize = buf[p];
    if ((headerSize !== 12 && headerSize !== 14) || buf.toString('ascii', p + 8, p + 12) !== '.FIT') break;
    const dataSize = buf.readUInt32LE(p + 4);
    const end = Math.min(buf.length, p + headerSize + dataSize);
    let q = p + headerSize;
    const defs = new Map();
    let lastTimestamp = null;
    while (q < end) {
      const h = buf[q++];
      if (h & 0x80) {
        // Compressed timestamp header: 5-bit offset from the last timestamp.
        const local = (h >> 5) & 0x03;
        const def = defs.get(local);
        if (!def) break;
        const offset = h & 0x1f;
        if (lastTimestamp !== null) {
          lastTimestamp = (lastTimestamp & ~0x1f) + offset + (offset < (lastTimestamp & 0x1f) ? 0x20 : 0);
        }
        const msg = readData(buf, q, def);
        if (!msg) break;
        if (lastTimestamp !== null && msg.fields[253] === undefined) msg.fields[253] = lastTimestamp;
        messages.push(msg);
        q += def.size;
        continue;
      }
      const local = h & 0x0f;
      if (h & 0x40) {
        // Definition message.
        if (q + 5 > end) break;
        const little = buf[q + 1] === 0;
        const global = little ? buf.readUInt16LE(q + 2) : buf.readUInt16BE(q + 2);
        const count = buf[q + 4];
        q += 5;
        const fields = [];
        let size = 0;
        for (let i = 0; i < count && q + 3 <= end; i++) {
          const f = { num: buf[q], size: buf[q + 1], base: buf[q + 2] };
          fields.push(f);
          size += f.size;
          q += 3;
        }
        if (h & 0x20) {
          const devCount = buf[q++];
          for (let i = 0; i < devCount && q + 3 <= end; i++) {
            size += buf[q + 1];
            q += 3;
          }
        }
        defs.set(local, { global, little, fields, size });
        continue;
      }
      const def = defs.get(local);
      if (!def || q + def.size > end) break;
      const msg = readData(buf, q, def);
      if (msg) {
        if (msg.fields[253] !== undefined) lastTimestamp = msg.fields[253];
        messages.push(msg);
      }
      q += def.size;
    }
    p = end + 2; // skip the CRC
  }
  return messages;
}

function readData(buf, q, def) {
  if (q + def.size > buf.length) return null;
  const fields = {};
  let pos = q;
  for (const f of def.fields) {
    const baseSize = BASE_SIZES[f.base] ?? f.size;
    if (f.size === baseSize || f.base === 0x07) {
      const v = readValue(buf, pos, f.base, f.size, def.little);
      if (!isInvalid(v, f.base)) fields[f.num] = v;
    }
    pos += f.size;
  }
  return { global: def.global, fields };
}

// ---------- the board's view of a workout file ----------

const toMs = (fitSeconds) => FIT_EPOCH_MS + fitSeconds * 1000;
const pick = (list, max) => {
  if (list.length <= max) return list;
  const out = [];
  for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]);
  return out;
};
const round = (v, d = 0) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/**
 * Splits, heart-rate curve, altitude and GPS trace from a workout zip (or a bare .FIT).
 * splits.kind is 'laps' when the watch recorded more than one lap, else 'km' (computed per kilometre).
 */
export function workoutFromFile(buffer, { maxHr = 600, maxTrace = 1500 } = {}) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const isFit = buf.length > 12 && buf.toString('ascii', 8, 12) === '.FIT';
  const fit = isFit ? buf : (unzip(buf).find((e) => /\.fit$/i.test(e.name)) ?? unzip(buf)[0])?.data;
  if (!fit) return { splits: { kind: 'laps', list: [] }, hr: [], altitude: [], trace: [], startMs: null };
  const messages = decodeFit(fit);
  const records = messages.filter((m) => m.global === 20 && m.fields[253] !== undefined);
  const laps = messages.filter((m) => m.global === 19);
  const startMs = records.length ? toMs(records[0].fields[253]) : (laps.length && laps[0].fields[2] !== undefined ? toMs(laps[0].fields[2]) : null);
  const secs = (m) => (startMs === null ? 0 : Math.round((toMs(m.fields[253]) - startMs) / 1000));

  const hr = records.filter((m) => m.fields[3] !== undefined).map((m) => [secs(m), m.fields[3]]);
  const altitude = records
    .map((m) => [secs(m), m.fields[78] !== undefined ? m.fields[78] / 5 - 500 : (m.fields[2] !== undefined ? m.fields[2] / 5 - 500 : null)])
    .filter((a) => a[1] !== null)
    .map(([s, a]) => [s, round(a, 1)]);
  const trace = records
    .filter((m) => m.fields[0] !== undefined && m.fields[1] !== undefined)
    .map((m) => [round(m.fields[0] * SEMI, 6), round(m.fields[1] * SEMI, 6)])
    .filter(([lat, lon]) => Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0));

  let splits;
  if (laps.length > 1) {
    splits = {
      kind: 'laps',
      list: laps.map((m, i) => ({
        index: i + 1,
        seconds: round((m.fields[8] ?? m.fields[7] ?? 0) / 1000),
        distanceM: round((m.fields[9] ?? 0) / 100),
        avgHr: m.fields[15] ?? null,
        maxHr: m.fields[16] ?? null,
        ascentM: m.fields[21] ?? null,
      })),
    };
  } else {
    splits = { kind: 'km', list: kmSplits(records, secs) };
  }
  return { startMs, splits, hr: pick(hr, maxHr), altitude: pick(altitude, maxHr), trace: pick(trace, maxTrace) };
}

/** One split per full kilometre (and the remainder), from the record stream. */
function kmSplits(records, secs) {
  const out = [];
  let startSec = 0, startDist = 0, startAlt = null, hrSum = 0, hrN = 0, hrMax = 0, ascent = 0, lastAlt = null, nextKm = 1000;
  const alt = (m) => (m.fields[78] !== undefined ? m.fields[78] / 5 - 500 : (m.fields[2] !== undefined ? m.fields[2] / 5 - 500 : null));
  let last = null;
  for (const m of records) {
    const dist = m.fields[5] !== undefined ? m.fields[5] / 100 : null;
    const a = alt(m);
    if (a !== null) {
      if (lastAlt !== null && a > lastAlt) ascent += a - lastAlt;
      lastAlt = a;
      if (startAlt === null) startAlt = a;
    }
    if (m.fields[3] !== undefined) { hrSum += m.fields[3]; hrN++; hrMax = Math.max(hrMax, m.fields[3]); }
    last = m;
    if (dist !== null && dist >= nextKm) {
      out.push({ index: out.length + 1, seconds: secs(m) - startSec, distanceM: round(dist - startDist), avgHr: hrN ? Math.round(hrSum / hrN) : null, maxHr: hrMax || null, ascentM: round(ascent) });
      startSec = secs(m); startDist = dist; hrSum = 0; hrN = 0; hrMax = 0; ascent = 0; nextKm += 1000;
    }
  }
  if (last) {
    const dist = last.fields[5] !== undefined ? last.fields[5] / 100 : null;
    const rest = dist !== null ? dist - startDist : null;
    if (rest === null || rest > 50 || !out.length) {
      out.push({ index: out.length + 1, seconds: secs(last) - startSec, distanceM: round(rest ?? 0), avgHr: hrN ? Math.round(hrSum / hrN) : null, maxHr: hrMax || null, ascentM: round(ascent) });
    }
  }
  return out;
}
