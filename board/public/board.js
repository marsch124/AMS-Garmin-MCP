// AMS Garmin Board — draws the instruments. Plain browser JavaScript, no libraries.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LOCALE = 'sv-SE';
  const HOME_ZONE = 'Europe/Stockholm';
  const REFRESH_EVERY_MS = 10 * 60 * 1000;
  const WEATHER_EVERY_MS = 30 * 60 * 1000;
  const SCHEME_KEY = 'ams-garmin-board.scheme';
  const LOCATION_KEY = 'ams-garmin-board.location';
  const SCHEMES = ['calm-dusk', 'calm-dark', 'calm-day', 'ice', 'ember', 'forest', 'graphite'];
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---------- formatting ----------

  const pad2 = (n) => String(n).padStart(2, '0');
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const fmtInt = (n) => (isNum(n) ? Math.round(n).toLocaleString(LOCALE) : '—');
  const fmtKm = (m) => (isNum(m) ? (m / 1000).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km' : '—');
  const fmtKg = (kg) => (isNum(kg) ? kg.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg' : '—');
  const fmt1 = (n) => (isNum(n) ? n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');
  const fmtDur = (s) => {
    if (!isNum(s)) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h} h ${pad2(m)}` : `${m} min`;
  };
  const fmtMin = (min) => {
    if (!isNum(min)) return '—';
    const sign = min < 0 ? '−' : '';
    const a = Math.abs(Math.round(min));
    return `${sign}${Math.floor(a / 60)} h ${pad2(a % 60)}`;
  };
  const fmtHours = (s) => (isNum(s) ? `${Math.floor(s / 3600)} h ${pad2(Math.round((s % 3600) / 60))}` : '—');
  const fmtClock = (date, timeZone, seconds = true) => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hour12: false, ...(timeZone ? { timeZone } : {}),
  }).format(date);
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const MONTHS_LONG = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const parseLocal = (s) => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  };
  const fmtWhen = (s) => {
    const d = parseLocal(s);
    return d ? `${DAY_NAMES[d.getDay()]} ${d.getDate()} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '—';
  };
  const fmtDay = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
  };
  const fmtStamp = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '—';
  };
  const monthLong = (ym) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  const monthWord = (ym) => MONTHS_LONG[Number(ym.slice(5, 7)) - 1];
  const todayIso = () => new Date().toLocaleDateString('sv-SE');
  const prevYm = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`; };
  const nextYm = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`; };
  const daysInYm = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
  function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.floor((date - start) / 86400000) + 1;
  }
  function stardate(date) {
    return `${date.getFullYear()}.${String(dayOfYear(date)).padStart(3, '0')}`;
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  // ---------- SVG helpers ----------

  const polar = (cx, cy, r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  function arcPath(cx, cy, r, startDeg, endDeg) {
    const [x1, y1] = polar(cx, cy, r, startDeg);
    const [x2, y2] = polar(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  const f1 = (n) => Number(n).toFixed(1);
  const emptySvg = (W, H, text) => `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2 + 5}" text-anchor="middle" font-size="15" fill="${css('--dim')}">${escapeHtml(text)}</text></svg>`;

  /** A 270° arc gauge: value against a maximum, with an overflow ring once past it. */
  function drawArcGauge(host, { value, max, color, over = css('--c6'), big, small, unit }) {
    const ratio = isNum(value) && isNum(max) && max > 0 ? Math.min(1, value / max) : 0;
    const overRatio = isNum(value) && isNum(max) && max > 0 && value > max ? Math.min(1, (value - max) / max) : 0;
    const start = -135, sweep = 270, cx = 100, cy = 100, r = 78;
    const ticks = [];
    for (let i = 0; i <= 10; i++) {
      const a = start + (sweep * i) / 10;
      const [x1, y1] = polar(cx, cy, r - 12, a);
      const [x2, y2] = polar(cx, cy, r - (i % 5 === 0 ? 20 : 16), a);
      ticks.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${i % 5 === 0 ? color : css('--grid')}" stroke-width="2"/>`);
    }
    host.innerHTML = `
      <svg viewBox="0 0 200 178" role="img" aria-label="${escapeHtml(big)} ${escapeHtml(unit || '')}">
        <path d="${arcPath(cx, cy, r, start, start + sweep)}" class="track" fill="none" stroke-width="14" stroke-linecap="round"/>
        ${ratio > 0.002 ? `<path d="${arcPath(cx, cy, r, start, start + sweep * ratio)}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>` : ''}
        ${overRatio > 0.002 ? `<path d="${arcPath(cx, cy, r - 22, start, start + sweep * overRatio)}" fill="none" stroke="${over}" stroke-width="5" stroke-linecap="round"/>` : ''}
        ${ticks.join('')}
        <text x="100" y="104" text-anchor="middle" font-size="40" font-weight="700" fill="${color}">${escapeHtml(big)}</text>
        ${unit ? `<text x="100" y="124" text-anchor="middle" font-size="12" fill="${css('--dim')}">${escapeHtml(unit)}</text>` : ''}
        <text x="100" y="166" text-anchor="middle" font-size="14" fill="${css('--c8')}">${escapeHtml(small || '')}</text>
      </svg>`;
  }

  /** A vertical thermometer-style bar with a scale, the current value and markers. */
  function drawThermo(host, { value, lo, hi, step, color, unit, markers = [], label, decimals = 0 }) {
    const top = 14, bottom = 196, x = 62, w = 22;
    const span = hi - lo || 1;
    const yOf = (v) => bottom - ((Math.min(hi, Math.max(lo, v)) - lo) / span) * (bottom - top);
    const scale = [];
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const y = yOf(v);
      scale.push(`<line x1="${x - 10}" y1="${f1(y)}" x2="${x - 3}" y2="${f1(y)}" stroke="${css('--dim')}" stroke-width="1.5"/>`);
      scale.push(`<text x="${x - 14}" y="${f1(y + 4)}" text-anchor="end" font-size="11" fill="${css('--dim')}">${decimals ? v.toFixed(decimals) : Math.round(v)}</text>`);
    }
    const fill = isNum(value)
      ? `<rect x="${x}" y="${f1(yOf(value))}" width="${w}" height="${f1(bottom - yOf(value))}" rx="6" fill="${color}"/>`
      : '';
    const placed = [];
    const marks = markers.filter((m) => isNum(m.value)).map((m) => {
      const y = yOf(m.value);
      let ty = y + 4;
      for (const p of placed) if (Math.abs(ty - p) < 12) ty = p + 12;
      placed.push(ty);
      return `<line x1="${x + w + 3}" y1="${f1(y)}" x2="${x + w + 14}" y2="${f1(y)}" stroke="${m.color || css('--c8')}" stroke-width="2"/>
              <text x="${x + w + 18}" y="${f1(ty)}" font-size="11" fill="${m.color || css('--c8')}">${escapeHtml(m.label)} ${decimals ? m.value.toFixed(decimals) : Math.round(m.value)}</text>`;
    }).join('');
    const shown = isNum(value) ? (decimals ? value.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.round(value)) : '—';
    host.innerHTML = `
      <svg viewBox="0 0 150 240" role="img" aria-label="${escapeHtml(label || '')} ${escapeHtml(shown)}">
        <rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" rx="11" class="track" fill="${css('--track')}"/>
        ${fill}
        <circle cx="${x + w / 2}" cy="${bottom + 10}" r="14" fill="${isNum(value) ? color : css('--track')}"/>
        ${scale.join('')}
        ${marks}
        <text x="75" y="236" text-anchor="middle" font-size="22" font-weight="700" fill="${color}">${escapeHtml(shown)}${unit ? ` <tspan font-size="12" fill="${css('--dim')}">${escapeHtml(unit)}</tspan>` : ''}</text>
      </svg>`;
  }

  /** A half-circle dial with coloured zones and a needle. */
  function drawDial(host, { value, lo, hi, zones, color, label, unit }) {
    const cx = 85, cy = 86, r = 66;
    const span = hi - lo || 1;
    const angleOf = (v) => -90 + ((Math.min(hi, Math.max(lo, v)) - lo) / span) * 180;
    const zoneArcs = zones.map((z) => `<path d="${arcPath(cx, cy, r, angleOf(z.from), angleOf(z.to))}" fill="none" stroke="${z.color}" stroke-width="12" opacity=".85"/>`).join('');
    const ticks = [];
    for (let v = lo; v <= hi; v += 10) {
      const a = angleOf(v);
      const [x1, y1] = polar(cx, cy, r - 10, a);
      const [x2, y2] = polar(cx, cy, r - 16, a);
      const [tx, ty] = polar(cx, cy, r - 26, a);
      ticks.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${css('--dim')}" stroke-width="1.5"/>`);
      ticks.push(`<text x="${f1(tx)}" y="${f1(ty + 3)}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${v}</text>`);
    }
    let needle = '';
    if (isNum(value)) {
      const a = angleOf(value);
      const [nx, ny] = polar(cx, cy, r - 6, a);
      const [bx, by] = polar(cx, cy, 10, a + 180);
      needle = `<line x1="${f1(bx)}" y1="${f1(by)}" x2="${f1(nx)}" y2="${f1(ny)}" stroke="${css('--text')}" stroke-width="3" stroke-linecap="round"/>`;
    }
    host.innerHTML = `
      <svg viewBox="0 0 170 128" role="img" aria-label="${escapeHtml(label)} ${isNum(value) ? value : '—'}">
        <path d="${arcPath(cx, cy, r, -90, 90)}" fill="none" stroke="${css('--track')}" stroke-width="12"/>
        ${zoneArcs}${ticks.join('')}${needle}
        <circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>
        <text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="30" font-weight="700" fill="${color}">${isNum(value) ? value : '—'}</text>
        <text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="10" fill="${css('--dim')}">${escapeHtml(label)}${unit ? ' · ' + escapeHtml(unit) : ''}</text>
      </svg>`;
  }

  /** A horizontal segmented bar with a marker. */
  function drawHBar(host, { value, max = 100, segments, marker, markerLabel, fillColor, label }) {
    const w = 300, h = 26, y = 8, barH = 12;
    const xOf = (v) => (Math.min(max, Math.max(0, v)) / max) * w;
    const segs = segments.map((s) => `<rect x="${f1(xOf(s.from))}" y="${y}" width="${f1(xOf(s.to) - xOf(s.from))}" height="${barH}" fill="${s.color}" opacity=".45"/>`).join('');
    const fill = isNum(value) ? `<rect x="0" y="${y}" width="${f1(xOf(value))}" height="${barH}" rx="6" fill="${fillColor || css('--c8')}" opacity=".9"/>` : '';
    const mark = isNum(marker)
      ? `<line x1="${f1(xOf(marker))}" y1="2" x2="${f1(xOf(marker))}" y2="${y + barH + 4}" stroke="${css('--c7')}" stroke-width="2"/>
         <text x="${f1(Math.min(w - 2, xOf(marker)))}" y="${y + barH + 14}" text-anchor="${xOf(marker) > w - 40 ? 'end' : 'middle'}" font-size="9" fill="${css('--c7')}">${escapeHtml(markerLabel || '')}</text>`
      : '';
    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h + 8}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(label || 'bar')} ${isNum(value) ? value : '—'}">
        <rect x="0" y="${y}" width="${w}" height="${barH}" rx="6" fill="${css('--track')}"/>
        ${segs}${fill}${mark}
      </svg>`;
  }

  /** Bars per day with the goal marked on each bar; a dot under days with a log line. */
  function drawBars(host, days, { color, todayColor, goalColor, today, logDays = new Set() }) {
    const n = Math.max(1, days.length);
    const W = 620, H = 180, padL = 34, padB = 20, padT = 14;
    const plotW = W - padL - 6, plotH = H - padB - padT;
    const top = Math.max(1, ...days.map((d) => Math.max(d.steps || 0, d.stepGoal || 0)));
    const niceTop = Math.ceil(top / 5000) * 5000 || 5000;
    const bw = plotW / n;
    const yOf = (v) => padT + plotH - (v / niceTop) * plotH;
    const gridLines = [];
    for (let v = 0; v <= niceTop; v += 5000) {
      gridLines.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - 6}" y2="${f1(yOf(v))}" class="gridline"/>`);
      gridLines.push(`<text x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v / 1000}K</text>`);
    }
    const bars = days.map((d, i) => {
      const x = padL + i * bw + bw * 0.15;
      const w = bw * 0.7;
      const steps = d.steps || 0;
      const isToday = d.date === today;
      const met = d.stepGoal && steps >= d.stepGoal;
      const fill = isToday ? todayColor : color;
      const bar = steps > 0
        ? `<rect x="${f1(x)}" y="${f1(yOf(steps))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(steps))}" rx="2" fill="${fill}" opacity="${met || isToday ? 1 : 0.55}"><title>${d.date}: ${fmtInt(steps)} steps</title></rect>`
        : '';
      const goal = d.stepGoal
        ? `<line x1="${f1(x - 2)}" y1="${f1(yOf(d.stepGoal))}" x2="${f1(x + w + 2)}" y2="${f1(yOf(d.stepGoal))}" stroke="${goalColor}" stroke-width="2"/>`
        : '';
      const label = `<text x="${f1(x + w / 2)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${isToday ? todayColor : css('--dim')}">${Number(d.date.slice(8))}</text>`;
      const dot = logDays.has(d.date) ? `<circle cx="${f1(x + w / 2)}" cy="${H - 1.5}" r="1.6" fill="${css('--c3')}"><title>${escapeHtml(logDays.get ? logDays.get(d.date) : '')}</title></circle>` : '';
      return bar + goal + label + dot;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="steps per day">${gridLines.join('')}${bars}</svg>`;
  }

  /** A line per day for the resting pulse, with the month average dashed. */
  function drawLine(host, days, { color, avg, avgColor, today }) {
    const W = 620, H = 180, padL = 30, padB = 20, padT = 14;
    const plotW = W - padL - 10, plotH = H - padB - padT;
    const pts = days.filter((d) => isNum(d.restingHr));
    if (!pts.length) { host.innerHTML = emptySvg(W, H, 'NO PULSE DATA YET'); return; }
    const values = pts.map((d) => d.restingHr);
    const lo = Math.floor((Math.min(...values, avg ?? Infinity) - 4) / 5) * 5;
    const hi = Math.ceil((Math.max(...values, avg ?? -Infinity) + 4) / 5) * 5;
    const n = Math.max(1, days.length);
    const xOf = (i) => padL + (i + 0.5) * (plotW / n);
    const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
    const grid = [];
    for (let v = lo; v <= hi; v += 5) {
      grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - 10}" y2="${f1(yOf(v))}" class="gridline"/>`);
      grid.push(`<text x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
    }
    const indexOf = new Map(days.map((d, i) => [d.date, i]));
    const path = pts.map((d, k) => `${k ? 'L' : 'M'} ${f1(xOf(indexOf.get(d.date)))} ${f1(yOf(d.restingHr))}`).join(' ');
    const dots = pts.map((d) => {
      const i = indexOf.get(d.date);
      const isToday = d.date === today;
      return `<circle cx="${f1(xOf(i))}" cy="${f1(yOf(d.restingHr))}" r="4" fill="${isToday ? css('--bg') : color}" stroke="${color}" stroke-width="2"/>
              <text x="${f1(xOf(i))}" y="${f1(yOf(d.restingHr) - 8)}" text-anchor="middle" font-size="10" fill="${isToday ? css('--dim') : css('--c8')}">${d.restingHr}</text>`;
    }).join('');
    const labels = days.map((d, i) => `<text x="${f1(xOf(i))}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${d.date === today ? css('--c6') : css('--dim')}">${Number(d.date.slice(8))}</text>`).join('');
    const avgLine = isNum(avg)
      ? `<line x1="${padL}" y1="${f1(yOf(avg))}" x2="${W - 10}" y2="${f1(yOf(avg))}" stroke="${avgColor}" stroke-width="1.5" stroke-dasharray="5 4"/>
         <text x="${W - 12}" y="${f1(yOf(avg) - 4)}" text-anchor="end" font-size="9" fill="${avgColor}">AVG ${avg}</text>`
      : '';
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="resting pulse per day">${grid.join('')}${avgLine}<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  /** Today's Body Battery readings over the 24 hours, with Garmin's sleep / activity / recovery spans shaded. */
  function drawCurve(host, points, events) {
    const W = 620, H = 150, padL = 26, padR = 8, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!points.length) { host.innerHTML = emptySvg(W, H, 'NO BODY BATTERY READINGS YET TODAY'); return; }
    const minuteOf = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
    const xOf = (ms) => padL + (Math.min(1440, Math.max(0, minuteOf(ms))) / 1440) * plotW;
    const yOf = (v) => padT + plotH - (Math.min(100, Math.max(0, v)) / 100) * plotH;
    const colors = { SLEEP: css('--c3'), ACTIVITY: css('--c7'), RECOVERY: css('--c5') };
    const dayStart = new Date(points[0][0]); dayStart.setHours(0, 0, 0, 0);
    const spans = events.map((e) => {
      const x1 = Math.max(padL, xOf(Math.max(e.startMs, dayStart.getTime())));
      const x2 = Math.min(W - padR, xOf(e.endMs ?? e.startMs));
      if (x2 <= x1) return '';
      return `<rect x="${f1(x1)}" y="${padT}" width="${f1(x2 - x1)}" height="${plotH}" fill="${colors[e.type] || css('--grid')}" opacity=".22"><title>${escapeHtml(e.type)}${isNum(e.impact) ? ` ${e.impact > 0 ? '+' : ''}${e.impact}` : ''}</title></rect>`;
    }).join('');
    const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`).join('');
    const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<text x="${f1(padL + (h / 24) * plotW)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${pad2(h % 24)}</text>`).join('');
    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p[0]))} ${f1(yOf(p[1]))}`).join(' ');
    const last = points[points.length - 1];
    const legend = Object.entries(colors).map(([k, c], i) => `<rect x="${padL + 60 + i * 80}" y="${padT}" width="8" height="8" fill="${c}" opacity=".6"/><text x="${padL + 72 + i * 80}" y="${padT + 8}" font-size="9" fill="${css('--dim')}">${k}</text>`).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="body battery today">${spans}${grid}${hours}${legend}
      <path d="${path}" fill="none" stroke="${css('--c5')}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${f1(xOf(last[0]))}" cy="${f1(yOf(last[1]))}" r="4" fill="${css('--c5')}"/>
      <text x="${f1(Math.min(W - padR - 2, xOf(last[0]) + 6))}" y="${f1(yOf(last[1]) - 6)}" font-size="12" font-weight="700" fill="${css('--c5')}" text-anchor="${xOf(last[0]) > W - 60 ? 'end' : 'start'}">${last[1]}</text></svg>`;
  }

  /** Stacked zones bar with the zone floors from the watch. */
  function drawZones(host, { secondsInZone, floors, maxHr, total }) {
    const W = 300, H = 56;
    if (!total) { host.innerHTML = emptySvg(W, H, 'NO WORKOUTS WITH HEART RATE YET THIS WEEK'); return; }
    const colors = [css('--c3'), css('--c5'), css('--c6'), css('--c1'), css('--c7')];
    let x = 0;
    const segs = secondsInZone.map((s, i) => {
      const w = (s / total) * W;
      const seg = `<rect x="${f1(x)}" y="4" width="${f1(w)}" height="16" fill="${colors[i]}"><title>Zone ${i + 1}: ${fmtDur(s)}</title></rect>`;
      x += w;
      return seg;
    }).join('');
    const legend = secondsInZone.map((s, i) => {
      const lx = (i % 5) * 60;
      const floor = floors[i], ceil = i < 4 ? floors[i + 1] : maxHr;
      return `<rect x="${lx}" y="30" width="8" height="8" fill="${colors[i]}"/><text x="${lx + 11}" y="38" font-size="9" fill="${css('--text')}">Z${i + 1} ${fmtDur(s)}</text>
              <text x="${lx + 11}" y="50" font-size="8.5" fill="${css('--dim')}">${isNum(floor) ? `${floor}${isNum(ceil) ? '–' + ceil : '+'}` : ''}</text>`;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="heart-rate zones this week"><rect x="0" y="4" width="${W}" height="16" rx="8" fill="${css('--track')}"/><g clip-path="inset(0 round 8px)">${segs}</g>${legend}</svg>`;
  }

  /** 90 days of weigh-ins, the 7-day average and the goal. */
  function drawWeightTrend(host, { points, avg7, goalKg, days = 90 }, today) {
    const W = 420, H = 150, padL = 32, padR = 8, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!points.length) { host.innerHTML = emptySvg(W, H, 'NO WEIGH-INS IN 90 DAYS'); return; }
    const end = new Date(today + 'T00:00:00');
    const start = new Date(end.getTime() - days * 86400000);
    const xOf = (iso) => padL + Math.min(1, Math.max(0, (new Date(iso + 'T00:00:00') - start) / (end - start))) * plotW;
    const all = points.map((p) => p.kg).concat(isNum(goalKg) ? [goalKg] : []);
    const lo = Math.floor(Math.min(...all) - 0.6), hi = Math.ceil(Math.max(...all) + 0.6);
    const yOf = (kg) => padT + plotH - ((kg - lo) / (hi - lo || 1)) * plotH;
    const step = hi - lo > 8 ? 2 : 1;
    const grid = [];
    for (let v = lo; v <= hi; v += step) grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
    const months = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDate() === 1) months.push(`<text x="${f1(xOf(d.toLocaleDateString('sv-SE')))}" y="${H - 5}" font-size="9" fill="${css('--dim')}">${MONTHS[d.getMonth()]}</text>`);
    }
    const dots = points.map((p) => `<circle cx="${f1(xOf(p.date))}" cy="${f1(yOf(p.kg))}" r="2.5" fill="${css('--c6')}" opacity=".8"><title>${p.date}: ${fmtKg(p.kg)}</title></circle>`).join('');
    const avgPath = avg7.map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p.date))} ${f1(yOf(p.kg))}`).join(' ');
    const goal = isNum(goalKg) ? `<line x1="${padL}" y1="${f1(yOf(goalKg))}" x2="${W - padR}" y2="${f1(yOf(goalKg))}" stroke="${css('--c3')}" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - padR - 2}" y="${f1(yOf(goalKg) - 4)}" text-anchor="end" font-size="9" fill="${css('--c3')}">GOAL ${fmt1(goalKg)}</text>` : '';
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="weight over 90 days">${grid.join('')}${months.join('')}${goal}<path d="${avgPath}" fill="none" stroke="${css('--c8')}" stroke-width="2" stroke-linejoin="round"/>${dots}</svg>`;
  }

  /** Seven nights: need (outline) against slept + naps (filled). */
  function drawSleepDebt(host, nights) {
    const W = 300, H = 110, padL = 26, padB = 16, padT = 8;
    const plotW = W - padL - 6, plotH = H - padB - padT;
    const top = Math.max(60, ...nights.map((n) => Math.max(n.needMin || 0, (n.sleptMin || 0) + (n.napMin || 0)))) / 60;
    const hiH = Math.ceil(top);
    const yOf = (min) => padT + plotH - ((min / 60) / hiH) * plotH;
    const bw = plotW / 7;
    const grid = [];
    for (let h = 0; h <= hiH; h += 2) grid.push(`<line x1="${padL}" y1="${f1(yOf(h * 60))}" x2="${W - 6}" y2="${f1(yOf(h * 60))}" class="gridline"/><text x="${padL - 4}" y="${f1(yOf(h * 60) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${h}H</text>`);
    const bars = nights.map((n, i) => {
      const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      const need = isNum(n.needMin) ? `<rect x="${f1(x)}" y="${f1(yOf(n.needMin))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(n.needMin))}" fill="none" stroke="${css('--dim')}" stroke-dasharray="3 2"/>` : '';
      const slept = n.sleptMin ? `<rect x="${f1(x)}" y="${f1(yOf(n.sleptMin))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(n.sleptMin))}" rx="2" fill="${css('--c4')}"/>` : '';
      const nap = n.napMin ? `<rect x="${f1(x)}" y="${f1(yOf(n.sleptMin + n.napMin))}" width="${f1(w)}" height="${f1(yOf(n.sleptMin) - yOf(n.sleptMin + n.napMin))}" fill="${css('--c5')}"/>` : '';
      const d = new Date(n.date + 'T00:00:00');
      return `${need}${slept}${nap}<text x="${f1(x + w / 2)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${DAY_NAMES[d.getDay()]}</text>`;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="sleep need against actual">${grid.join('')}${bars}</svg>`;
  }

  /** Heart rate over a workout with the altitude as a soft area behind it. */
  function drawHrCurve(host, hr, altitude) {
    const W = 520, H = 200, padL = 30, padR = 30, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!hr.length && !altitude.length) { host.innerHTML = emptySvg(W, H, 'NO HEART-RATE CURVE IN THE FILE'); return; }
    const maxT = Math.max(1, ...hr.map((p) => p[0]), ...altitude.map((p) => p[0]));
    const xOf = (t) => padL + (t / maxT) * plotW;
    let area = '';
    if (altitude.length) {
      const alts = altitude.map((p) => p[1]);
      const aLo = Math.min(...alts), aHi = Math.max(...alts);
      const yA = (a) => padT + plotH - ((a - aLo) / (aHi - aLo || 1)) * plotH * 0.8;
      area = `<path d="M ${f1(xOf(altitude[0][0]))} ${padT + plotH} ${altitude.map((p) => `L ${f1(xOf(p[0]))} ${f1(yA(p[1]))}`).join(' ')} L ${f1(xOf(altitude[altitude.length - 1][0]))} ${padT + plotH} Z" fill="${css('--c6')}" opacity=".18"/>
              <text x="${W - padR + 2}" y="${f1(yA(aHi) + 3)}" font-size="9" fill="${css('--c6')}">${Math.round(aHi)} M</text><text x="${W - padR + 2}" y="${f1(yA(aLo) + 3)}" font-size="9" fill="${css('--c6')}">${Math.round(aLo)} M</text>`;
    }
    let line = '';
    if (hr.length) {
      const vals = hr.map((p) => p[1]);
      const lo = Math.floor((Math.min(...vals) - 5) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
      const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
      const grid = [];
      for (let v = lo; v <= hi; v += 10) grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
      line = `${grid.join('')}<path d="${hr.map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p[0]))} ${f1(yOf(p[1]))}`).join(' ')}" fill="none" stroke="${css('--c7')}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    const ticks = [];
    const stepMin = maxT > 7200 ? 30 : maxT > 3600 ? 15 : maxT > 1200 ? 5 : 1;
    for (let t = 0; t <= maxT; t += stepMin * 60) ticks.push(`<text x="${f1(xOf(t))}" y="${H - 5}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${Math.round(t / 60)}'</text>`);
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="heart rate over the workout">${area}${line}${ticks.join('')}</svg>`;
  }

  /** The GPS trace, drawn to fit the box. */
  function drawTrace(host, trace) {
    const W = 300, H = 220, pad = 12;
    if (trace.length < 2) { host.innerHTML = emptySvg(W, H, 'NO GPS TRACE'); return; }
    const lats = trace.map((p) => p[0]), lons = trace.map((p) => p[1]);
    const latC = (Math.min(...lats) + Math.max(...lats)) / 2;
    const kx = Math.cos((latC * Math.PI) / 180);
    const xs = lons.map((l) => l * kx), ys = lats;
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min((W - 2 * pad) / (maxX - minX || 1e-6), (H - 2 * pad) / (maxY - minY || 1e-6));
    const ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxY - minY) * scale) / 2;
    const X = (i) => ox + (xs[i] - minX) * scale, Y = (i) => H - (oy + (ys[i] - minY) * scale);
    const d = trace.map((_, i) => `${i ? 'L' : 'M'} ${f1(X(i))} ${f1(Y(i))}`).join(' ');
    const last = trace.length - 1;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="route"><path d="${d}" fill="none" stroke="${css('--c5')}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${f1(X(0))}" cy="${f1(Y(0))}" r="5" fill="${css('--ok')}"/><circle cx="${f1(X(last))}" cy="${f1(Y(last))}" r="5" fill="${css('--c7')}"/></svg>`;
  }

  // ---------- clocks ----------

  function tickClocks() {
    const now = new Date();
    $('clock-local').textContent = fmtClock(now);
    $('clock-home').textContent = fmtClock(now, HOME_ZONE, false);
    $('clock-utc').textContent = fmtClock(now, 'UTC', false);
    $('stardate').textContent = stardate(now);
    $('week-number').textContent = `WEEK ${isoWeek(now)}`;
    $('day-number').textContent = `DAY ${dayOfYear(now)}`;
    $('clock-date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'LOCAL';
    const offsetMin = -now.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '−';
    $('clock-local-zone').textContent = `${zone.replace(/_/g, ' ')} · UTC${sign}${Math.floor(Math.abs(offsetMin) / 60)}${offsetMin % 60 ? ':' + pad2(Math.abs(offsetMin) % 60) : ''}`;
    const h = now.getHours();
    document.body.classList.toggle('night', document.body.classList.contains('kiosk') && (h >= 21 || h < 7));
  }

  // ---------- rendering the data ----------

  const TYPE_TAGS = {
    running: ['RUN', '--c2'], treadmill_running: ['RUN', '--c2'], trail_running: ['RUN', '--c2'], indoor_running: ['RUN', '--c2'],
    cycling: ['BIKE', '--c5'], road_biking: ['BIKE', '--c5'], indoor_cycling: ['BIKE', '--c5'], virtual_ride: ['BIKE', '--c5'], mountain_biking: ['BIKE', '--c5'], gravel_cycling: ['BIKE', '--c5'],
    hiking: ['HIKE', '--c6'], walking: ['WALK', '--c6'],
    strength_training: ['STR', '--c3'],
    open_water_swimming: ['SWIM', '--c4'], lap_swimming: ['SWIM', '--c4'], swimming: ['SWIM', '--c4'],
    yoga: ['YOGA', '--c8'], breathwork: ['BREATH', '--c8'], cardio: ['CARDIO', '--c1'], indoor_cardio: ['CARDIO', '--c1'],
    elliptical: ['CARDIO', '--c1'], rowing: ['ROW', '--c4'], indoor_rowing: ['ROW', '--c4'], skiing: ['SKI', '--c5'],
  };
  const SWIMS = new Set(['lap_swimming', 'open_water_swimming', 'swimming']);
  const RUNS = new Set(['running', 'treadmill_running', 'trail_running', 'indoor_running', 'track_running', 'virtual_run']);
  function typeTag(type) {
    const t = TYPE_TAGS[type];
    if (t) return { text: t[0], color: css(t[1]) };
    return { text: String(type || 'OTHER').replace(/_/g, ' ').slice(0, 6), color: css('--c1') };
  }

  let board = null;          // the latest /api/board answer
  let viewYm = null;         // null = the current month; else 'YYYY-MM'
  let monthData = null;      // the month block currently shown
  let pageVersion = null;
  let weatherData = null;

  function renderToday(b) {
    const t = b.today || {};
    drawArcGauge($('steps-gauge'), {
      value: t.steps, max: t.stepGoal, color: css('--c2'),
      big: fmtInt(t.steps), unit: 'STEPS',
      small: isNum(t.stepGoal) ? `${Math.round(((t.steps || 0) / t.stepGoal) * 100)} % OF GOAL` : 'NO GOAL SET',
    });
    setText('steps-value', fmtInt(t.steps));
    setText('steps-goal', fmtInt(t.stepGoal));
    setText('distance-value', fmtKm(t.distanceM));

    const bb = t.bodyBattery || {};
    drawThermo($('body-battery-bar'), {
      value: bb.latest, lo: 0, hi: 100, step: 20, color: css('--c5'), label: 'BODY BATTERY',
      markers: [{ value: bb.max, label: 'HIGH', color: css('--c6') }, { value: bb.min, label: 'LOW', color: css('--c7') }],
    });
    setText('bb-charged', isNum(bb.charged) ? `+${bb.charged}` : '—');
    setText('bb-drained', isNum(bb.drained) ? `−${bb.drained}` : '—');

    drawDial($('resting-hr'), {
      value: t.restingHr, lo: 40, hi: 100, color: css('--c7'), label: 'RESTING', unit: 'BPM',
      zones: [{ from: 40, to: 55, color: css('--c5') }, { from: 55, to: 70, color: css('--c6') }, { from: 70, to: 100, color: css('--c7') }],
    });
    setText('hr-min', isNum(t.minHr) ? `${t.minHr}` : '—');
    setText('hr-max', isNum(t.maxHr) ? `${t.maxHr}` : '—');
    setText('hr-month-avg', isNum(b.month?.restingHrAvg) ? `${b.month.restingHrAvg}` : '—');

    drawHBar($('stress-bar'), {
      value: t.stressAvg, marker: t.stressMax, markerLabel: isNum(t.stressMax) ? `MAX ${t.stressMax}` : '', label: 'stress',
      segments: [{ from: 0, to: 25, color: css('--c5') }, { from: 25, to: 50, color: css('--c6') }, { from: 50, to: 75, color: css('--c1') }, { from: 75, to: 100, color: css('--c7') }],
    });
    setText('stress-avg', isNum(t.stressAvg) ? `${t.stressAvg}` : 'UNKNOWN');
    setText('stress-max', isNum(t.stressMax) ? `${t.stressMax}` : '—');
    setText('respiration-value', isNum(t.respirationAvg) ? `${t.respirationAvg} / MIN` : '—');

    const week = b.week || {};
    drawArcGauge($('intensity-gauge'), {
      value: week.intensityMinutes, max: week.goal, color: css('--c1'),
      big: fmtInt(week.intensityMinutes), unit: 'MINUTES',
      small: isNum(week.goal) ? `${Math.round(((week.intensityMinutes || 0) / week.goal) * 100)} % OF WEEKLY GOAL` : 'NO GOAL SET',
    });
    setText('intensity-week', fmtInt(week.intensityMinutes));
    setText('intensity-goal', fmtInt(week.goal));
    setText('intensity-month', fmtInt(b.month?.intensityMinutes));

    setText('calories-value', fmtInt(t.caloriesTotal));
    setText('calories-active', fmtInt(t.caloriesActive));
    setText('floors-value', fmtInt(t.floorsUp));
    setText('floors-goal', fmtInt(t.floorsGoal));
  }

  function renderAlerts(b) {
    const list = b.alerts || [];
    const panel = $('red-alert');
    panel.hidden = !list.length;
    panel.classList.toggle('flash', list.length > 0);
    $('red-alert-text').textContent = list.map((a) => a.text).join('  ·  ');
    document.title = list.length ? '⚠ AMS Garmin Board' : 'AMS Garmin Board';
  }

  function renderSleep(b) {
    const s = b.sleep || {};
    const host = $('sleep-body');
    if (!s.recorded) {
      host.innerHTML = `<div class="nodata">NO SLEEP DATA<small>WEAR THE WATCH AT NIGHT — THE NIGHT APPEARS HERE IN THE MORNING</small></div>`;
      return;
    }
    const total = (s.deepSeconds || 0) + (s.lightSeconds || 0) + (s.remSeconds || 0) + (s.awakeSeconds || 0) || s.seconds || 1;
    const pct = (v) => `${((v || 0) / total) * 100}%`;
    const parts = [['DEEP', s.deepSeconds, css('--c4')], ['LIGHT', s.lightSeconds, css('--c5')], ['REM', s.remSeconds, css('--c3')], ['AWAKE', s.awakeSeconds, css('--c7')]];
    host.innerHTML = `
      <div class="big-row">
        <div class="big"><span class="v">${fmtHours(s.seconds)}</span><span class="k">ASLEEP</span></div>
        <div class="big"><span class="v">${isNum(s.score) ? s.score : '—'}</span><span class="k">SLEEP SCORE</span></div>
      </div>
      <div class="stack">${parts.map(([, v, c]) => `<span style="width:${pct(v)};background:${c}"></span>`).join('')}</div>
      <div class="legend">${parts.map(([k, v, c]) => `<span><i style="background:${c}"></i>${k} ${fmtHours(v)}</span>`).join('')}</div>
      <div class="kv-row">
        <div class="kv"><span class="k">BEDTIME</span><span class="v">${s.start ? fmtClock(new Date(s.start), undefined, false) : '—'}</span></div>
        <div class="kv"><span class="k">WAKE</span><span class="v">${s.end ? fmtClock(new Date(s.end), undefined, false) : '—'}</span></div>
        ${isNum(s.needMinutes) ? `<div class="kv"><span class="k">NEED</span><span class="v">${fmtMin(s.needMinutes)}</span></div>` : ''}
      </div>`;
  }

  function renderHrv(b) {
    const h = b.hrv || {};
    const host = $('hrv-body');
    if (!h.recorded) {
      host.innerHTML = `<div class="nodata">NO HRV DATA<small>RECORDED OVERNIGHT, WITH THE WATCH ON</small></div>`;
      return;
    }
    host.innerHTML = `
      <div class="big-row"><div class="big"><span class="v">${h.lastNight}</span><span class="k">LAST NIGHT · MS</span></div></div>
      <div class="kv-row">
        <div class="kv"><span class="k">7-DAY AVG</span><span class="v">${isNum(h.weeklyAvg) ? h.weeklyAvg : '—'}</span></div>
        <div class="kv"><span class="k">STATUS</span><span class="v">${escapeHtml(h.status || '—').replace(/_/g, ' ')}</span></div>
        <div class="kv"><span class="k">BASELINE</span><span class="v">${isNum(h.baselineLow) && isNum(h.baselineHigh) ? `${h.baselineLow}–${h.baselineHigh}` : '—'}</span></div>
      </div>`;
  }

  function renderSleepDebt(b) {
    const d = b.sleepDebt || { recorded: false, nights: [] };
    if (!d.recorded) {
      setText('sleep-debt-value', 'NO NIGHTS YET');
      setText('sleep-debt-note', 'FILLS ONCE THE WATCH IS WORN AT NIGHT');
      $('sleep-debt-chart').innerHTML = '';
      return;
    }
    const debt = d.debtMin;
    setText('sleep-debt-value', `${debt > 0 ? '−' : '+'}${fmtMin(Math.abs(debt))}`);
    setText('sleep-debt-note', debt > 0 ? `SHORT OF YOUR NEED · ${d.nights.filter((n) => n.recorded).length} NIGHTS COUNTED` : `AHEAD OF YOUR NEED · ${d.nights.filter((n) => n.recorded).length} NIGHTS COUNTED`);
    drawSleepDebt($('sleep-debt-chart'), d.nights);
  }

  function renderWeight(b) {
    const w = b.weight;
    const kg = w?.kg;
    const base = isNum(kg) ? Math.floor((kg - 4) / 2) * 2 : 70;
    const trend = b.weightTrend || { points: [], avg7: [], goalKg: null };
    drawThermo($('weight-thermo'), {
      value: kg, lo: base, hi: base + 10, step: 2, color: css('--c6'), unit: 'KG', label: 'WEIGHT', decimals: 1,
      markers: isNum(trend.goalKg) && trend.goalKg >= base && trend.goalKg <= base + 10 ? [{ value: trend.goalKg, label: 'GOAL', color: css('--c3') }] : [],
    });
    setText('weight-date', w?.date ? fmtDay(w.date) : 'NO WEIGH-IN');
    setText('weight-delta', isNum(w?.deltaKg) ? `${w.deltaKg > 0 ? '+' : w.deltaKg < 0 ? '−' : ''}${Math.abs(w.deltaKg).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg` : '—');
    setText('weight-goal', isNum(trend.goalKg) ? fmtKg(trend.goalKg) : '—');
    drawWeightTrend($('weight-trend-chart'), trend, b.date);
  }

  function renderBbCurve(b) {
    const c = b.bodyBatteryCurve || { points: [], events: [] };
    drawCurve($('bb-curve-chart'), c.points, c.events);
    setText('bb-curve-note', c.points.length ? `${c.points.length} READINGS` : '');
  }

  function renderFitness(b) {
    const f = b.fitness || {};
    const v = f.vo2max || {}, a = f.fitnessAge || {};
    setText('vo2max-value', isNum(v.value) ? fmt1(v.value) : '—');
    const trendEl = $('vo2max-trend');
    trendEl.className = `trend ${v.trend ? 'trend-' + v.trend : ''}`;
    setText('fitness-age-value', isNum(a.value) ? `${Math.round(a.value)}` : '—');
    const at = $('fitness-age-trend');
    at.className = `trend ${a.trend ? 'trend-' + a.trend : ''}`;
    setText('chrono-age-value', isNum(a.chronological) ? `${a.chronological}` : '—');
    const notes = [];
    if (v.date) notes.push(`VO2 MAX FROM ${fmtDay(v.date)}${isNum(v.prev) ? ` (BEFORE ${fmt1(v.prev)})` : ''}`);
    else notes.push('VO2 MAX: NOT SHARED BY GARMIN\'S PERSONAL API YET');
    if (isNum(a.value) && isNum(a.chronological)) notes.push(`${Math.round(a.chronological - a.value)} YEARS YOUNGER THAN THE CALENDAR`);
    setText('fitness-note', notes.join(' · '));
  }

  function renderTraining(b) {
    const t = b.training || {};
    const chip = $('training-status');
    chip.textContent = t.status || '—';
    chip.classList.toggle('warn', t.status === 'OVERREACHING');
    drawHBar($('training-load-bar'), {
      value: isNum(t.ratio) ? Math.min(2, t.ratio) : null, max: 2, fillColor: css('--c1'), label: 'training ratio',
      marker: 1, markerLabel: 'BALANCED',
      segments: [{ from: 0, to: 0.8, color: css('--c5') }, { from: 0.8, to: 1.0, color: css('--c6') }, { from: 1.0, to: 1.3, color: css('--ok') }, { from: 1.3, to: 2, color: css('--c7') }],
    });
    setText('training-acute', isNum(t.acute) ? fmtInt(t.acute) : '—');
    setText('training-chronic', isNum(t.chronic) ? fmtInt(t.chronic) : '—');
    setText('training-ratio', isNum(t.ratio) ? t.ratio.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
  }

  function renderZones(b) {
    const z = b.zones || { secondsInZone: [0, 0, 0, 0, 0], total: 0, floors: [], maxHr: null };
    setText('zones-total', z.total ? fmtDur(z.total) : '—');
    drawZones($('zones-chart'), z);
  }

  function renderStreaks(b) {
    const s = b.streaks || {};
    const days = (n) => (isNum(n) ? `${n} ${n === 1 ? 'DAY' : 'DAYS'}` : '—');
    const best = (x) => (x && isNum(x.longest) ? `${days(x.longest)}${x.longestEnd ? ` <small>TO ${fmtDay(x.longestEnd)}</small>` : ''}` : '—');
    setText('streak-steps-current', days(s.stepGoal?.current));
    $('streak-steps-longest').innerHTML = best(s.stepGoal);
    setText('streak-workout-current', days(s.workouts?.current));
    $('streak-workout-longest').innerHTML = best(s.workouts);
  }

  function renderYear(b) {
    const y = b.year || { months: [] };
    const current = b.date.slice(0, 7);
    const maxSteps = Math.max(1, ...y.months.map((m) => m.steps));
    for (const m of y.months) {
      const tile = $(`year-tile-${m.ym.slice(5, 7)}`);
      if (!tile) continue;
      const future = m.ym > current;
      tile.className = `tile${future ? ' future' : ''}${m.ym === current ? ' current' : ''}`;
      tile.innerHTML = `<span class="tm">${MONTHS[Number(m.ym.slice(5, 7)) - 1]}</span>
        <span class="tv">${future ? '—' : fmtInt(m.steps)}</span><span class="tk">STEPS</span>
        <span class="tbar"><i style="width:${Math.round((m.steps / maxSteps) * 100)}%"></i></span>
        <span class="tv">${future ? '—' : m.workouts}</span><span class="tk">WORKOUTS · ${fmtDur(m.trainingSeconds)}</span>
        <span class="tv">${isNum(m.restingHrAvg) ? m.restingHrAvg : '—'}</span><span class="tk">RESTING · ${m.stepGoalDays} GOAL DAYS</span>`;
      tile.style.cursor = future ? 'default' : 'pointer';
      tile.onclick = future ? null : () => showMonth(m.ym === current ? null : m.ym);
    }
    const totalSteps = y.months.reduce((a, m) => a + m.steps, 0);
    const totalWorkouts = y.months.reduce((a, m) => a + m.workouts, 0);
    setText('year-note', `${y.year} · ${fmtInt(totalSteps)} STEPS · ${totalWorkouts} WORKOUTS · ${fmtDur(y.months.reduce((a, m) => a + m.trainingSeconds, 0))}`);
    const label = $('explain-year');
    if (label) label.textContent = `THE YEAR ${y.year}`;
  }

  function renderTravel(travel) {
    const row = $('travel-row');
    row.hidden = !travel;
    setText('chrono-note', travel ? 'AWAY' : '');
    if (!travel) return;
    setText('travel-days', `${travel.days}`);
    setText('travel-km', fmtKm(travel.distanceM));
    setText('travel-zone', String(travel.zone || '').split('/').pop().replace(/_/g, ' '));
  }

  // ----- the month group: steps, pulse, workouts, totals, targets, log -----

  function deltaText(el, block, { lower = false, count = false } = {}) {
    if (!el) return;
    el.className = 'd';
    if (!block || (!isNum(block.pct) && !isNum(block.diff))) { el.textContent = ''; return; }
    const diff = count || !isNum(block.pct) ? block.diff : null;
    const value = isNum(diff) ? diff : block.pct;
    if (value === 0) { el.textContent = '= LAST MONTH'; return; }
    const up = value > 0;
    const good = lower ? !up : up;
    el.classList.add(good ? 'good' : 'bad');
    el.textContent = `${up ? '▲' : '▼'} ${Math.abs(value)}${isNum(diff) ? '' : ' %'}`;
  }

  function renderMonthGroup(md) {
    const m = md.month || { days: [] };
    const a = md.activities || { list: [] };
    const c = md.compare || {};
    const ym = md.ym || board.date.slice(0, 7);
    const isCurrent = ym === board.date.slice(0, 7);
    const days = m.days || [];
    const word = monthWord(ym);
    const logMap = new Map(Object.entries(md.log || {}));
    const logDays = { has: (d) => logMap.has(d), get: (d) => logMap.get(d) };

    setText('explain-month-steps', `STEPS · ${word}`);
    setText('explain-month-hr', `RESTING PULSE · ${word}`);
    setText('explain-activities', `MISSION LOG · WORKOUTS IN ${word}`);
    setText('explain-month-totals', `TOTALS · ${word}`);
    setText('explain-targets', `MY TARGETS · ${word}`);
    setText('month-label', isCurrent ? `${monthLong(ym)} · SO FAR` : monthLong(ym));
    $('month-next').disabled = isCurrent;
    $('month-today').hidden = isCurrent;

    drawBars($('month-steps-chart'), days, { color: css('--c2'), todayColor: css('--c6'), goalColor: css('--c8'), today: board.date, logDays });
    const finishedDays = isCurrent ? Math.max(0, (m.daysWithData ?? 0) - 1) : (m.daysWithData ?? 0);
    setText('month-steps-note', `${fmtInt(m.steps)} STEPS · GOAL MET ${m.stepGoalDays ?? 0}/${finishedDays} DAYS`);
    drawLine($('month-hr-chart'), days, { color: css('--c7'), avg: m.restingHrAvg, avgColor: css('--c8'), today: board.date });
    setText('month-hr-note', isNum(m.restingHrMin) ? `${m.restingHrMin}–${m.restingHrMax} BPM` : '');

    setText('total-steps', fmtInt(m.steps));
    setText('total-avg-steps', fmtInt(m.avgSteps));
    setText('total-goal-days', `${m.stepGoalDays ?? 0} DAYS`);
    setText('total-distance', fmtKm(m.distanceM));
    setText('total-floors', fmtInt(m.floorsUp));
    setText('total-intensity', fmtInt(m.intensityMinutes));
    setText('total-resting-hr', isNum(m.restingHrAvg) ? `${m.restingHrAvg} (${m.restingHrMin}–${m.restingHrMax})` : '—');
    setText('total-workouts', `${a.count ?? 0}`);
    setText('total-training-time', fmtDur(a.seconds));
    setText('total-days', `${m.daysWithData ?? 0}`);
    deltaText($('delta-steps'), c.steps);
    deltaText($('delta-distance'), c.distanceM);
    deltaText($('delta-floors'), c.floorsUp);
    deltaText($('delta-intensity'), c.intensityMinutes);
    deltaText($('delta-resting-hr'), c.restingHrAvg, { lower: true, count: true });
    deltaText($('delta-workouts'), c.workouts, { count: true });
    deltaText($('delta-training-time'), c.trainingSeconds);
    setText('compare-note', c.previousMonth ? `VS ${monthWord(c.previousMonth)} TO DAY ${c.throughDay}` : '');

    renderActivities(a);
    renderTargets(board.targets || {}, m, a, ym, isCurrent);
    renderLog(md.log || {}, ym);
  }

  function renderActivities(a) {
    const list = a.list || [];
    setText('activities-total', list.length
      ? `${a.count} WORKOUTS · ${fmtDur(a.seconds)} · ${fmtKm(a.distanceM)} · ${fmtInt(a.calories)} KCAL · ${fmtInt(a.elevationGain)} M CLIMBED · CLICK ONE FOR THE DETAIL`
      : 'NO WORKOUTS YET THIS MONTH');
    $('activities-list').innerHTML = list.length
      ? list.map((x) => {
        const tag = typeTag(x.type);
        return `<div class="act" id="act-${escapeHtml(x.id)}" data-id="${escapeHtml(x.id)}" role="button" tabindex="0">
          <span class="tag" style="background:${tag.color}">${escapeHtml(tag.text)}</span>
          <span class="when">${fmtWhen(x.start)}</span>
          <span class="name" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</span>
          <span class="num n-dur">${fmtDur(x.seconds)}</span>
          <span class="num n-dist">${x.distanceM > 0 ? fmtKm(x.distanceM) : '—'}</span>
          <span class="num n-hr">${isNum(x.avgHr) ? `${x.avgHr} BPM` : '—'}</span>
          <span class="te">${escapeHtml((x.trainingEffect || '').replace(/_/g, ' '))}${isNum(x.aerobic) ? ` · TE ${x.aerobic.toFixed(1)}` : ''}</span>
        </div>`;
      }).join('')
      : '<div class="act-empty">THE LOG IS EMPTY. GO MOVE.</div>';
  }

  function renderTargets(targets, m, a, ym, isCurrent) {
    const list = a.list || [];
    const values = {
      steps: m.steps ?? 0,
      workouts: a.count ?? 0,
      swims: list.filter((x) => SWIMS.has(x.type)).length,
      runs: list.filter((x) => RUNS.has(x.type)).length,
      'training-minutes': Math.round((a.seconds ?? 0) / 60),
      'distance-km': Math.round((a.distanceM ?? 0) / 100) / 10,
    };
    const keys = { steps: 'steps', workouts: 'workouts', swims: 'swims', runs: 'runs', 'training-minutes': 'trainingMinutes', 'distance-km': 'distanceKm' };
    let shown = 0;
    for (const [id, key] of Object.entries(keys)) {
      const el = $(`target-bar-${id}`);
      const target = targets[key];
      const value = values[id];
      if (!isNum(target) || target <= 0) { el.hidden = true; continue; }
      el.hidden = false; shown++;
      const ratio = Math.min(1, value / target);
      el.classList.toggle('done', value >= target);
      el.querySelector('.bar i').style.width = `${Math.round(ratio * 100)}%`;
      el.querySelector('.tv').textContent = `${id === 'distance-km' ? fmt1(value) : fmtInt(value)} / ${id === 'distance-km' ? fmt1(target) : fmtInt(target)}`;
    }
    const total = daysInYm(ym);
    const day = isCurrent ? Number(board.date.slice(8)) : total;
    setText('targets-note', shown ? `DAY ${day} OF ${total} · ${Math.round((day / total) * 100)} % OF THE MONTH GONE` : 'NO TARGETS SET · EDIT TO ADD SOME');
  }

  function renderLog(entries, ym) {
    const today = board.date;
    const input = $('log-today-input');
    if (document.activeElement !== input) input.value = entries[today] ?? (board.log?.[today] ?? '');
    const dates = Object.keys(entries).sort().reverse();
    $('log-list').innerHTML = dates.length
      ? dates.map((d) => `<div class="log-line" id="log-line-${d}"><span class="d">${fmtDay(d)}</span><span class="t" title="${escapeHtml(entries[d])}">${escapeHtml(entries[d])}</span></div>`).join('')
      : `<div class="act-empty">NO LINES IN ${monthWord(ym)} YET. HOW WAS TODAY?</div>`;
    setText('log-note', dates.length ? `${dates.length} ${dates.length === 1 ? 'LINE' : 'LINES'}` : '');
  }

  async function saveLogLine() {
    const input = $('log-today-input');
    const button = $('log-save-button');
    button.disabled = true;
    try {
      const res = await fetch(`/api/log/${board.date}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: input.value }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'Could not save the line.');
      board.log = j.entries;
      if (!viewYm) { monthData.log = j.entries; renderLog(j.entries, board.date.slice(0, 7)); }
      button.textContent = 'SAVED';
      setTimeout(() => { button.textContent = 'SAVE'; }, 1200);
      input.blur();
    } catch (err) {
      button.textContent = 'FAILED';
      setTimeout(() => { button.textContent = 'SAVE'; }, 2000);
      console.error(err);
    } finally {
      button.disabled = false;
    }
  }

  // ----- month navigation -----

  async function showMonth(ym) {
    const current = board.date.slice(0, 7);
    if (ym && ym >= current) ym = null;
    viewYm = ym;
    if (!ym) {
      monthData = { ym: current, month: board.month, activities: board.activities, compare: board.compare, log: board.log };
      renderMonthGroup(monthData);
      return;
    }
    setText('month-label', `${monthLong(ym)} · LOADING`);
    try {
      const res = await fetch(`/api/month?ym=${ym}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `The board server answered ${res.status}.`);
      if (viewYm !== ym) return; // the user moved on
      monthData = j;
      renderMonthGroup(j);
    } catch (err) {
      setText('month-label', `${monthLong(ym)} · ${String(err.message || err).toUpperCase()}`);
    }
  }
  const stepMonth = (dir) => {
    const current = board.date.slice(0, 7);
    const from = viewYm || current;
    const to = dir < 0 ? prevYm(from) : nextYm(from);
    if (to >= current) showMonth(null); else showMonth(to);
  };

  // ----- workout detail -----

  async function showActivity(id) {
    const panel = $('activity-detail-panel');
    for (const row of document.querySelectorAll('.act.selected')) row.classList.remove('selected');
    $(`act-${id}`)?.classList.add('selected');
    panel.hidden = false;
    setText('detail-title', 'LOADING THE WORKOUT FILE');
    setText('detail-summary', '');
    $('detail-splits').innerHTML = '';
    $('detail-hr-chart').innerHTML = '';
    $('detail-map').innerHTML = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const res = await fetch(`/api/activity/${id}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `The board server answered ${res.status}.`);
      setText('detail-title', `${j.name || 'WORKOUT'}`);
      setText('detail-summary', [fmtWhen(j.start), fmtDur(j.seconds), j.distanceM > 0 ? fmtKm(j.distanceM) : null, isNum(j.avgHr) ? `${j.avgHr} BPM AVG` : null, isNum(j.maxHr) ? `${j.maxHr} MAX` : null, isNum(j.elevationGain) ? `${fmtInt(j.elevationGain)} M CLIMBED` : null, j.place].filter(Boolean).join(' · '));
      const splits = j.splits || [];
      $('detail-splits').innerHTML = splits.length
        ? `<span class="h">${j.splitsKind === 'laps' ? 'LAP' : 'KM'}</span><span class="h n">TIME</span><span class="h n">DIST</span><span class="h n">HR</span><span class="h n">CLIMB</span>`
          + splits.map((s) => `<span>${s.index}</span><span class="n">${fmtDur(s.seconds)}</span><span class="n">${s.distanceM > 0 ? (s.distanceM / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) : '—'}</span><span class="n">${isNum(s.avgHr) ? s.avgHr : '—'}</span><span class="n">${isNum(s.ascentM) ? `${s.ascentM} M` : '—'}</span>`).join('')
        : '<span class="act-empty">NO SPLITS IN THE FILE</span>';
      drawHrCurve($('detail-hr-chart'), j.hr || [], j.altitude || []);
      drawTrace($('detail-map'), j.trace || []);
    } catch (err) {
      setText('detail-title', `COULD NOT LOAD THE WORKOUT · ${String(err.message || err).toUpperCase()}`);
    }
  }

  // ----- weather -----

  function savedLocation() {
    try { const v = JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null'); return v && isNum(v.lat) && isNum(v.lon) ? v : null; } catch { return null; }
  }
  async function loadWeather() {
    const loc = savedLocation();
    const q = loc ? `?lat=${loc.lat.toFixed(3)}&lon=${loc.lon.toFixed(3)}` : '';
    try {
      const res = await fetch(`/api/weather${q}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'no weather');
      weatherData = j;
      renderWeather(j);
    } catch (err) {
      setText('weather-place', 'WEATHER UNAVAILABLE');
      setText('weather-text', String(err.message || err).toUpperCase());
    }
    $('weather-locate-button').textContent = loc ? 'AUTO' : 'LOCATE';
  }
  function renderWeather(w) {
    const src = { browser: 'THIS DEVICE', workout: 'LATEST WORKOUT', home: 'HOME' }[w.place?.source] || '';
    setText('weather-place', `${w.place?.name || '—'} · ${src}`);
    setText('weather-temp', isNum(w.now?.tempC) ? `${Math.round(w.now.tempC)}°` : '—');
    setText('weather-text', w.now?.text || '—');
    setText('weather-wind', isNum(w.now?.windKmh) ? `${Math.round(w.now.windKmh)} KM/H` : '—');
    setText('weather-rain', isNum(w.now?.precipMm) ? `${w.now.precipMm.toLocaleString(LOCALE)} MM` : '—');
    $('weather-hours').innerHTML = (w.hours || []).map((h) => `<div class="wx-h"><span>${h.time.slice(11, 13)}</span><b>${isNum(h.tempC) ? Math.round(h.tempC) + '°' : '—'}</b><span class="rain">${isNum(h.rainPct) ? h.rainPct + '%' : ''}</span></div>`).join('');
    const hhmm = (s) => (typeof s === 'string' && s.length >= 16 ? s.slice(11, 16) : '—');
    setText('sunrise-value', hhmm(w.sun?.sunrise));
    setText('sunset-value', hhmm(w.sun?.sunset));
  }
  function toggleLocate() {
    if (savedLocation()) {
      try { localStorage.removeItem(LOCATION_KEY); } catch { /* ignore */ }
      loadWeather();
      return;
    }
    if (!navigator.geolocation) { setText('weather-place', 'NO LOCATION ON THIS DEVICE'); return; }
    $('weather-locate-button').textContent = 'ASKING';
    navigator.geolocation.getCurrentPosition((pos) => {
      try { localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude })); } catch { /* ignore */ }
      loadWeather();
    }, () => {
      setText('weather-place', 'LOCATION NOT ALLOWED · USING THE AUTOMATIC PLACE');
      $('weather-locate-button').textContent = 'LOCATE';
    }, { timeout: 10000, maximumAge: 600000 });
  }

  // ----- travel -----

  async function reportZone() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    try {
      const res = await fetch('/api/travel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ zone }) });
      const j = await res.json();
      if (res.ok && j.ok) { if (board) board.travel = j.travel; renderTravel(j.travel); }
    } catch { /* the board's own travel block stays */ }
  }

  // ---------- link status, render all ----------

  function renderLink(b, error) {
    const status = $('link-status');
    const text = status.querySelector('.status-text');
    status.classList.remove('online', 'offline', 'syncing');
    if (error) {
      status.classList.add('offline');
      text.textContent = `GARMIN LINK OFFLINE · ${error}`;
      status.title = error;
      return;
    }
    status.classList.add('online');
    const warnings = b.warnings || [];
    text.textContent = warnings.length ? `GARMIN LINK ONLINE · ${warnings.length} NOTE${warnings.length > 1 ? 'S' : ''}` : 'GARMIN LINK ONLINE';
    status.title = warnings.join('\n');
    setText('token-expiry', fmtStamp(b.link?.tokenExpiresAt));
    setText('version-label', b.version ? `BOARD ${b.version}` : 'BOARD');
    setText('footer-version', b.version || '');
  }

  function render(b) {
    board = b;
    renderAlerts(b);
    renderToday(b);
    renderSleep(b);
    renderHrv(b);
    renderSleepDebt(b);
    renderWeight(b);
    renderBbCurve(b);
    renderFitness(b);
    renderTraining(b);
    renderZones(b);
    renderStreaks(b);
    renderYear(b);
    renderTravel(b.travel);
    if (!viewYm) {
      monthData = { ym: b.date.slice(0, 7), month: b.month, activities: b.activities, compare: b.compare, log: b.log };
      renderMonthGroup(monthData);
    } else if (monthData) {
      renderMonthGroup(monthData);
    }
    renderLink(b, null);
    if (weatherData) renderWeather(weatherData);
  }

  // ---------- loading ----------

  let timer = null;
  async function load(force = false) {
    const button = $('refresh-button');
    const status = $('link-status');
    button.disabled = true;
    button.textContent = 'SYNCING';
    status.classList.add('syncing');
    try {
      const res = await fetch(`/api/board${force ? '?refresh=1' : ''}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || `The board server answered ${res.status}.`);
      if (pageVersion && body.version && body.version !== pageVersion) { location.reload(); return; }
      pageVersion = pageVersion || body.version || null;
      render(body);
      $('last-refresh').textContent = fmtClock(new Date());
    } catch (err) {
      renderLink(null, err.message || String(err));
      $('last-refresh').textContent = `FAILED ${fmtClock(new Date())}`;
    } finally {
      status.classList.remove('syncing');
      button.disabled = false;
      button.textContent = 'REFRESH';
      clearTimeout(timer);
      timer = setTimeout(() => load(false), REFRESH_EVERY_MS);
    }
  }

  // ---------- sheets ----------

  const openSheet = (id) => { $(id).hidden = false; $(id).querySelector('button, input, select')?.focus?.(); };
  const closeSheets = () => { for (const s of document.querySelectorAll('.sheet')) s.hidden = true; };
  const anySheetOpen = () => [...document.querySelectorAll('.sheet')].some((s) => !s.hidden);

  function explain(key) {
    const ex = (globalThis.AMS_EXPLAIN || {})[key];
    if (!ex) return;
    setText('explain-title', ex.title || key.replace(/-/g, ' ').toUpperCase());
    setText('explain-summary', ex.summary || '');
    $('explain-more').innerHTML = (ex.more || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    openSheet('explain-sheet');
    $('explain-sheet').querySelector('.sheet-body').scrollTop = 0;
  }

  function mdToHtml(md) {
    const inline = (s) => escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    let html = '', inList = false, para = [];
    const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const endList = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const raw of String(md || '').split('\n')) {
      const line = raw.trimEnd();
      const h = /^(#{1,3})\s+(.*)/.exec(line);
      const li = /^\s*[-*]\s+(.*)/.exec(line);
      if (h) { flush(); endList(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; }
      else if (li) { flush(); if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; }
      else if (!line.trim()) { flush(); endList(); }
      else { endList(); para.push(line); }
    }
    flush(); endList();
    return html;
  }
  let docs = null;
  async function showHelp(tab = 'how') {
    openSheet('help-sheet');
    $('help-tab-how').classList.toggle('on', tab === 'how');
    $('help-tab-new').classList.toggle('on', tab === 'new');
    if (!docs) {
      try {
        const res = await fetch('/api/docs', { cache: 'no-store' });
        docs = await res.json();
      } catch (err) {
        $('help-content').textContent = `Could not load the guide: ${err.message || err}`;
        return;
      }
    }
    $('help-content').innerHTML = mdToHtml(tab === 'how' ? docs.howItWorks : docs.whatsNew);
    $('help-sheet').querySelector('.sheet-body').scrollTop = 0;
  }

  async function showSettings() {
    openSheet('settings-sheet');
    $('settings-error').hidden = true;
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      const j = await res.json();
      const t = j.settings?.targets || {};
      $('target-steps').value = t.steps ?? '';
      $('target-workouts').value = t.workouts ?? '';
      $('target-swims').value = t.swims ?? '';
      $('target-runs').value = t.runs ?? '';
      $('target-training-minutes').value = t.trainingMinutes ?? '';
      $('target-distance-km').value = t.distanceKm ?? '';
      $('access-code').value = '';
      $('access-code').placeholder = j.settings?.hasAccessCode ? 'A code is set · type a new one, or a space to remove it' : 'Set a code to open the board on your iPhone or iPad';
      setText('lan-address', j.settings?.lanAddress || '—');
    } catch (err) {
      $('settings-error').hidden = false;
      $('settings-error').textContent = `Could not load the settings: ${err.message || err}`;
    }
  }
  async function saveSettings() {
    const num = (id) => { const v = $(id).value.trim(); return v === '' ? undefined : Number(v); };
    const body = {
      targets: { steps: num('target-steps'), workouts: num('target-workouts'), swims: num('target-swims'), runs: num('target-runs'), trainingMinutes: num('target-training-minutes'), distanceKm: num('target-distance-km') },
    };
    const code = $('access-code').value;
    if (code !== '') body.accessCode = code.trim(); // a single space clears it
    $('settings-save').disabled = true;
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'Could not save.');
      if (board) { board.targets = j.settings.targets; if (monthData) renderMonthGroup(monthData); }
      closeSheets();
    } catch (err) {
      $('settings-error').hidden = false;
      $('settings-error').textContent = err.message || String(err);
    } finally {
      $('settings-save').disabled = false;
    }
  }

  async function showReport(kind = 'week') {
    openSheet('report-sheet');
    $('report-kind-week').classList.toggle('on', kind === 'week');
    $('report-kind-month').classList.toggle('on', kind === 'month');
    setText('report-title', kind === 'week' ? 'LAST WEEK' : 'LAST MONTH');
    setText('report-text', 'Loading…');
    try {
      const res = await fetch(`/api/report?kind=${kind}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'no report');
      setText('report-title', j.title);
      setText('report-text', j.text);
    } catch (err) {
      setText('report-text', `Could not build the report: ${err.message || err}`);
    }
  }

  // ---------- looks, kiosk, keys ----------

  function applyScheme(scheme, redraw = true) {
    if (!SCHEMES.includes(scheme)) scheme = 'calm-dusk';
    document.documentElement.setAttribute('data-scheme', scheme);
    $('palette-select').value = scheme;
    try { localStorage.setItem(SCHEME_KEY, scheme); } catch { /* ignore */ }
    if (redraw && board) render(board);
  }

  function toggleKiosk() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      const el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  }
  let idleTimer = null;
  function onFullscreenChange() {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    document.body.classList.toggle('kiosk', on);
    $('kiosk-button').textContent = on ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
    document.body.classList.remove('idle');
    tickClocks();
  }
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (document.body.classList.contains('kiosk')) idleTimer = setTimeout(() => document.body.classList.add('idle'), 5000);
  }

  function onKey(e) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape') { closeSheets(); if (typing) document.activeElement.blur(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (anySheetOpen() && e.key !== '?') return;
    switch (e.key) {
      case 'r': case 'R': load(true); break;
      case 'f': case 'F': toggleKiosk(); break;
      case 'ArrowLeft': if (board) stepMonth(-1); break;
      case 'ArrowRight': if (board) stepMonth(1); break;
      case '?': if (anySheetOpen()) closeSheets(); else showHelp('how'); break;
      default: return;
    }
    e.preventDefault();
  }

  // ---------- wiring ----------

  $('refresh-button').addEventListener('click', () => load(true));
  $('palette-select').addEventListener('change', (e) => applyScheme(e.target.value));
  $('kiosk-button').addEventListener('click', toggleKiosk);
  $('help-button').addEventListener('click', () => showHelp('how'));
  $('help-tab-how').addEventListener('click', () => showHelp('how'));
  $('help-tab-new').addEventListener('click', () => showHelp('new'));
  $('help-close').addEventListener('click', closeSheets);
  $('explain-close').addEventListener('click', closeSheets);
  $('settings-button').addEventListener('click', showSettings);
  $('targets-edit-button').addEventListener('click', showSettings);
  $('settings-cancel').addEventListener('click', closeSheets);
  $('settings-save').addEventListener('click', saveSettings);
  $('settings-form').addEventListener('submit', (e) => { e.preventDefault(); saveSettings(); });
  $('report-button').addEventListener('click', () => showReport('week'));
  $('report-kind-week').addEventListener('click', () => showReport('week'));
  $('report-kind-month').addEventListener('click', () => showReport('month'));
  $('report-close').addEventListener('click', closeSheets);
  $('month-prev').addEventListener('click', () => stepMonth(-1));
  $('month-next').addEventListener('click', () => stepMonth(1));
  $('month-today').addEventListener('click', () => showMonth(null));
  $('detail-close').addEventListener('click', () => {
    $('activity-detail-panel').hidden = true;
    for (const row of document.querySelectorAll('.act.selected')) row.classList.remove('selected');
  });
  $('log-save-button').addEventListener('click', saveLogLine);
  $('log-today-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveLogLine(); } });
  $('weather-locate-button').addEventListener('click', toggleLocate);
  $('activities-list').addEventListener('click', (e) => {
    const row = e.target.closest('.act[data-id]');
    if (row) showActivity(row.dataset.id);
  });
  $('activities-list').addEventListener('keydown', (e) => {
    const row = e.target.closest('.act[data-id]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showActivity(row.dataset.id); }
  });
  document.addEventListener('click', (e) => {
    const label = e.target.closest('button.label[id^="explain-"]');
    if (label) { explain(label.id.slice('explain-'.length)); return; }
    const sheet = e.target.closest('.sheet');
    if (sheet && e.target === sheet) closeSheets(); // click on the dark backdrop
  });
  document.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('mousemove', wake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(false); });

  applyScheme(document.documentElement.getAttribute('data-scheme') || 'calm-dusk', false);
  tickClocks();
  setInterval(tickClocks, 1000);
  load(false);
  loadWeather();
  setInterval(loadWeather, WEATHER_EVERY_MS);
  reportZone();
})();
