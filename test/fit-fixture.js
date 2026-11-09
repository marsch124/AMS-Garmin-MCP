// Test helper: builds a tiny, valid-enough FIT activity file and wraps it in a ZIP
// (method 0 = stored, no compression), the way Garmin's /download-service/files/activity/<id> answers.
// All numbers come from the caller; nothing here is real data.
import { Buffer } from 'node:buffer';

const GARMIN_EPOCH_S = 631065600; // 1989-12-31T00:00:00Z in unix seconds
const SEMI = 2 ** 31 / 180;       // degrees -> semicircles

// ---- CRC-32 (ZIP) ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- tiny writer: u8 / u16 / u32 / s32, little endian ----
class Out {
  constructor() { this.parts = []; }
  u8(v) { const b = Buffer.alloc(1); b.writeUInt8(v & 0xff); this.parts.push(b); return this; }
  u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xffff); this.parts.push(b); return this; }
  u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); this.parts.push(b); return this; }
  s32(v) { const b = Buffer.alloc(4); b.writeInt32LE(v | 0); this.parts.push(b); return this; }
  raw(buf) { this.parts.push(Buffer.from(buf)); return this; }
  get buffer() { return Buffer.concat(this.parts); }
}

// FIT base types used: 0x86 uint32, 0x85 sint32, 0x84 uint16, 0x02 uint8
function definition(out, local, globalNum, fields) {
  out.u8(0x40 | local).u8(0).u8(0).u16(globalNum).u8(fields.length);
  for (const [num, size, type] of fields) out.u8(num).u8(size).u8(type);
}

export function buildFit({ startMs, records = [], laps = [] }) {
  const startS = Math.round(startMs / 1000) - GARMIN_EPOCH_S;
  const body = new Out();

  // record message (global 20), local type 0
  definition(body, 0, 20, [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [3, 1, 0x02], [5, 4, 0x86], [2, 2, 0x84]]);
  for (const r of records) {
    body.u8(0)
      .u32(startS + r.t)
      .s32(Math.round(r.lat * SEMI))
      .s32(Math.round(r.lon * SEMI))
      .u8(r.hr)
      .u32(Math.round(r.distanceM * 100))
      .u16(Math.round((r.altM + 500) * 5));
  }

  // lap message (global 19), local type 1
  definition(body, 1, 19, [[253, 4, 0x86], [2, 4, 0x86], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86], [15, 1, 0x02], [16, 1, 0x02], [21, 2, 0x84]]);
  for (const l of laps) {
    body.u8(1)
      .u32(startS + l.t + Math.round(l.seconds))
      .u32(startS + l.t)
      .u32(Math.round(l.seconds * 1000))
      .u32(Math.round(l.seconds * 1000))
      .u32(Math.round(l.distanceM * 100))
      .u8(l.avgHr)
      .u8(l.maxHr)
      .u16(Math.round(l.ascentM));
  }

  const data = body.buffer;
  const header = new Out().u8(14).u8(0x20).u16(2140).u32(data.length).raw(Buffer.from('.FIT')).u16(0).buffer;
  return Buffer.concat([header, data, Buffer.from([0, 0])]); // trailing CRC left 0 (decoder ignores it)
}

/** A ZIP (stored) holding one file, activity.fit. */
export function buildFitZip({ startMs, records, laps }) {
  const data = buildFit({ startMs, records, laps });
  const name = Buffer.from('activity.fit');
  const crc = crc32(data);

  const local = new Out().u32(0x04034b50).u16(20).u16(0).u16(0).u16(0).u16(0)
    .u32(crc).u32(data.length).u32(data.length).u16(name.length).u16(0).raw(name).raw(data).buffer;

  const central = new Out().u32(0x02014b50).u16(20).u16(20).u16(0).u16(0).u16(0).u16(0)
    .u32(crc).u32(data.length).u32(data.length).u16(name.length).u16(0).u16(0).u16(0).u16(0).u32(0).u32(0)
    .raw(name).buffer;

  const end = new Out().u32(0x06054b50).u16(0).u16(0).u16(1).u16(1).u32(central.length).u32(local.length).u16(0).buffer;
  return Buffer.concat([local, central, end]);
}
