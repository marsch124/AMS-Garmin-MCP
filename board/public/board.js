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
  const SCHEMES = ['calm-dusk', 'calm-dark', 'calm-day', 'ice', 'ember', 'forest', 'graphite', 'rebel'];
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
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** 'AEROBIC_BASE' → 'Aerobic base': server words in capitals become a sentence. */
  const sentence = (w) => (w ? String(w).replace(/_/g, ' ').replace(/^(.)(.*)$/s, (m, a, b) => a.toUpperCase() + b.toLowerCase()) : '');
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
  const emptySvg = (W, H, text) => `<svg viewBox="0 0 ${W} ${H}"><text class="t-empty" x="${W / 2}" y="${H / 2 + 5}" text-anchor="middle" font-size="15" fill="${css('--dim')}">${escapeHtml(text)}</text></svg>`;

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
        <text class="t-hero" x="100" y="104" text-anchor="middle" font-size="40" font-weight="700" fill="${color}">${escapeHtml(big)}</text>
        ${unit ? `<text class="t-unit" x="100" y="124" text-anchor="middle" font-size="12" fill="${css('--dim')}">${escapeHtml(unit)}</text>` : ''}
        <text class="t-sub" x="100" y="166" text-anchor="middle" font-size="14" fill="${css('--c8')}">${escapeHtml(small || '')}</text>
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
      scale.push(`<text class="t-tick" x="${x - 14}" y="${f1(y + 4)}" text-anchor="end" font-size="11" fill="${css('--dim')}">${decimals ? v.toFixed(decimals) : Math.round(v)}</text>`);
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
              <text class="t-mark" x="${x + w + 18}" y="${f1(ty)}" font-size="11" fill="${m.color || css('--c8')}">${escapeHtml(m.label)} ${decimals ? m.value.toFixed(decimals) : Math.round(m.value)}</text>`;
    }).join('');
    const shown = isNum(value) ? (decimals ? value.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.round(value)) : '—';
    host.innerHTML = `
      <svg viewBox="0 0 150 240" role="img" aria-label="${escapeHtml(label || '')} ${escapeHtml(shown)}">
        <rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" rx="11" class="track" fill="${css('--track')}"/>
        ${fill}
        <circle cx="${x + w / 2}" cy="${bottom + 10}" r="14" fill="${isNum(value) ? color : css('--track')}"/>
        ${scale.join('')}
        ${marks}
        <text class="t-hero" x="75" y="236" text-anchor="middle" font-size="22" font-weight="700" fill="${color}">${escapeHtml(shown)}${unit ? ` <tspan font-size="12" fill="${css('--dim')}">${escapeHtml(unit)}</tspan>` : ''}</text>
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
      ticks.push(`<text class="t-tick" x="${f1(tx)}" y="${f1(ty + 3)}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${v}</text>`);
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
        <text class="t-hero" x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="30" font-weight="700" fill="${color}">${isNum(value) ? value : '—'}</text>
        <text class="t-unit" x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="10" fill="${css('--dim')}">${escapeHtml(label)}${unit ? ' · ' + escapeHtml(unit) : ''}</text>
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
         <text class="t-mark" x="${f1(Math.min(w - 2, xOf(marker)))}" y="${y + barH + 14}" text-anchor="${xOf(marker) > w - 40 ? 'end' : 'middle'}" font-size="9" fill="${css('--c7')}">${escapeHtml(markerLabel || '')}</text>`
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
      gridLines.push(`<text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v / 1000}k</text>`);
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
      const label = `<text class="t-tick" x="${f1(x + w / 2)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${isToday ? todayColor : css('--dim')}">${Number(d.date.slice(8))}</text>`;
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
    if (!pts.length) { host.innerHTML = emptySvg(W, H, 'No pulse data yet'); return; }
    const values = pts.map((d) => d.restingHr);
    const lo = Math.floor((Math.min(...values, avg ?? Infinity) - 4) / 5) * 5;
    const hi = Math.ceil((Math.max(...values, avg ?? -Infinity) + 4) / 5) * 5;
    const n = Math.max(1, days.length);
    const xOf = (i) => padL + (i + 0.5) * (plotW / n);
    const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
    const grid = [];
    for (let v = lo; v <= hi; v += 5) {
      grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - 10}" y2="${f1(yOf(v))}" class="gridline"/>`);
      grid.push(`<text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
    }
    const indexOf = new Map(days.map((d, i) => [d.date, i]));
    const path = pts.map((d, k) => `${k ? 'L' : 'M'} ${f1(xOf(indexOf.get(d.date)))} ${f1(yOf(d.restingHr))}`).join(' ');
    const dots = pts.map((d) => {
      const i = indexOf.get(d.date);
      const isToday = d.date === today;
      return `<circle cx="${f1(xOf(i))}" cy="${f1(yOf(d.restingHr))}" r="4" fill="${isToday ? css('--bg') : color}" stroke="${color}" stroke-width="2"/>
              <text class="t-val" x="${f1(xOf(i))}" y="${f1(yOf(d.restingHr) - 8)}" text-anchor="middle" font-size="10" fill="${isToday ? css('--dim') : css('--c8')}">${d.restingHr}</text>`;
    }).join('');
    const labels = days.map((d, i) => `<text class="t-tick" x="${f1(xOf(i))}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${d.date === today ? css('--c6') : css('--dim')}">${Number(d.date.slice(8))}</text>`).join('');
    const avgLine = isNum(avg)
      ? `<line x1="${padL}" y1="${f1(yOf(avg))}" x2="${W - 10}" y2="${f1(yOf(avg))}" stroke="${avgColor}" stroke-width="1.5" stroke-dasharray="5 4"/>
         <text class="t-mark" x="${W - 12}" y="${f1(yOf(avg) - 4)}" text-anchor="end" font-size="9" fill="${avgColor}">avg ${avg}</text>`
      : '';
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="resting pulse per day">${grid.join('')}${avgLine}<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  /** Today's Body Battery readings over the 24 hours, with Garmin's sleep / activity / recovery spans shaded. */
  function drawCurve(host, points, events, workouts = []) {
    const W = 620, H = 150, padL = 26, padR = 8, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!points.length) { host.innerHTML = emptySvg(W, H, 'No Body Battery readings yet today'); return; }
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
    const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`).join('');
    const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<text class="t-tick" x="${f1(padL + (h / 24) * plotW)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${pad2(h % 24)}</text>`).join('');
    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p[0]))} ${f1(yOf(p[1]))}`).join(' ');
    const last = points[points.length - 1];
    // 1.9.0: a dashed line and a label at the start of each of today's workouts, with what it drained.
    const wks = workouts.filter((w) => isNum(w.startMs) && w.startMs >= dayStart.getTime()).map((w, i) => {
      const x = xOf(w.startMs);
      const tag = typeTag(w.type);
      const drain = isNum(w.drain) && w.drain !== 0 ? ` ${w.drain > 0 ? '−' : '+'}${Math.abs(w.drain)}` : '';
      const label = `${sentence(tag.text)}${drain}`;
      const ly = padT + 20 + (i % 2) * 12;
      const anchor = x > W - 70 ? 'end' : 'start';
      return `<g class="bb-wk" id="bb-wk-${escapeHtml(w.id)}" data-id="${escapeHtml(w.id)}" role="button" tabindex="0" style="cursor:pointer"><title>${escapeHtml(w.name)}${drain ? ` · Body Battery${drain}` : ''}</title>
        <line x1="${f1(x)}" y1="${padT}" x2="${f1(x)}" y2="${padT + plotH}" stroke="${tag.color}" stroke-width="1.5" stroke-dasharray="3 3"/>
        <rect x="${f1(anchor === 'end' ? x - 64 : x)}" y="${ly - 10}" width="64" height="14" fill="transparent"/>
        <text class="t-legend" x="${f1(anchor === 'end' ? x - 4 : x + 4)}" y="${ly}" text-anchor="${anchor}" font-size="10" font-weight="700" fill="${tag.color}">${escapeHtml(label)}</text></g>`;
    }).join('');
    const legend = Object.entries(colors).map(([k, c], i) => `<rect x="${padL + 60 + i * 80}" y="${padT}" width="8" height="8" fill="${c}" opacity=".6"/><text class="t-legend" x="${padL + 72 + i * 80}" y="${padT + 8}" font-size="9" fill="${css('--dim')}">${sentence(k)}</text>`).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="body battery today">${spans}${grid}${hours}${legend}${wks}
      <path d="${path}" fill="none" stroke="${css('--c5')}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${f1(xOf(last[0]))}" cy="${f1(yOf(last[1]))}" r="4" fill="${css('--c5')}"/>
      <text class="t-hero" x="${f1(Math.min(W - padR - 2, xOf(last[0]) + 6))}" y="${f1(yOf(last[1]) - 6)}" font-size="12" font-weight="700" fill="${css('--c5')}" text-anchor="${xOf(last[0]) > W - 60 ? 'end' : 'start'}">${last[1]}</text></svg>`;
  }

  /** Stacked zones bar with the zone floors from the watch. */
  function drawZones(host, { secondsInZone, floors, maxHr, total }) {
    const W = 300, H = 56;
    if (!total) { host.innerHTML = emptySvg(W, H, 'No workouts with heart rate yet this week'); return; }
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
      return `<rect x="${lx}" y="30" width="8" height="8" fill="${colors[i]}"/><text class="t-legend" x="${lx + 11}" y="38" font-size="9" fill="${css('--text')}">Z${i + 1} ${fmtDur(s)}</text>
              <text class="t-legend" x="${lx + 11}" y="50" font-size="8.5" fill="${css('--dim')}">${isNum(floor) ? `${floor}${isNum(ceil) ? '–' + ceil : '+'}` : ''}</text>`;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="heart-rate zones this week"><rect x="0" y="4" width="${W}" height="16" rx="8" fill="${css('--track')}"/><g clip-path="inset(0 round 8px)">${segs}</g>${legend}</svg>`;
  }

  /** 90 days of weigh-ins, the 7-day average and the goal. */
  function drawWeightTrend(host, { points, avg7, goalKg, days = 90 }, today) {
    const W = 420, H = 150, padL = 32, padR = 8, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!points.length) { host.innerHTML = emptySvg(W, H, 'No weigh-ins in 90 days'); return; }
    const end = new Date(today + 'T00:00:00');
    const start = new Date(end.getTime() - days * 86400000);
    const xOf = (iso) => padL + Math.min(1, Math.max(0, (new Date(iso + 'T00:00:00') - start) / (end - start))) * plotW;
    const all = points.map((p) => p.kg).concat(isNum(goalKg) ? [goalKg] : []);
    const lo = Math.floor(Math.min(...all) - 0.6), hi = Math.ceil(Math.max(...all) + 0.6);
    const yOf = (kg) => padT + plotH - ((kg - lo) / (hi - lo || 1)) * plotH;
    const step = hi - lo > 4 ? 2 : 1;
    const grid = [];
    for (let v = lo; v <= hi; v += step) grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
    const months = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDate() === 1) months.push(`<text class="t-tick" x="${f1(xOf(d.toLocaleDateString('sv-SE')))}" y="${H - 5}" font-size="9" fill="${css('--dim')}">${MONTHS[d.getMonth()]}</text>`);
    }
    const dots = points.map((p) => `<circle cx="${f1(xOf(p.date))}" cy="${f1(yOf(p.kg))}" r="2.5" fill="${css('--c6')}" opacity=".8"><title>${p.date}: ${fmtKg(p.kg)}</title></circle>`).join('');
    const avgPath = avg7.map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p.date))} ${f1(yOf(p.kg))}`).join(' ');
    const goal = isNum(goalKg) ? `<line x1="${padL}" y1="${f1(yOf(goalKg))}" x2="${W - padR}" y2="${f1(yOf(goalKg))}" stroke="${css('--c3')}" stroke-width="1.5" stroke-dasharray="5 4"/><text class="t-mark" x="${W - padR - 2}" y="${f1(yOf(goalKg) - 4)}" text-anchor="end" font-size="9" fill="${css('--c3')}">goal ${fmt1(goalKg)}</text>` : '';
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
    for (let h = 0; h <= hiH; h += 2) grid.push(`<line x1="${padL}" y1="${f1(yOf(h * 60))}" x2="${W - 6}" y2="${f1(yOf(h * 60))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(h * 60) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${h} h</text>`);
    const bars = nights.map((n, i) => {
      const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      const need = isNum(n.needMin) ? `<rect x="${f1(x)}" y="${f1(yOf(n.needMin))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(n.needMin))}" fill="none" stroke="${css('--dim')}" stroke-dasharray="3 2"/>` : '';
      const slept = n.sleptMin ? `<rect x="${f1(x)}" y="${f1(yOf(n.sleptMin))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(n.sleptMin))}" rx="2" fill="${css('--c4')}"/>` : '';
      const nap = n.napMin ? `<rect x="${f1(x)}" y="${f1(yOf(n.sleptMin + n.napMin))}" width="${f1(w)}" height="${f1(yOf(n.sleptMin) - yOf(n.sleptMin + n.napMin))}" fill="${css('--c5')}"/>` : '';
      const d = new Date(n.date + 'T00:00:00');
      return `${need}${slept}${nap}<text class="t-tick" x="${f1(x + w / 2)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${DAY_NAMES[d.getDay()]}</text>`;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="sleep need against actual">${grid.join('')}${bars}</svg>`;
  }

  /** 1.4: average steps per weekday over 12 weeks; the weakest day in the alert colour, the strongest in green. */
  function drawRhythm(host, r) {
    const W = 300, H = 120, padL = 28, padB = 16, padT = 14;
    const plotW = W - padL - 6, plotH = H - padB - padT;
    const days = r.days || [];
    const vals = days.map((d) => d.avg).filter(isNum);
    if (!vals.length) { host.innerHTML = emptySvg(W, H, 'No days with data yet'); return; }
    const top = Math.ceil(Math.max(...vals, r.overallAvg || 0) / 2500) * 2500 || 2500;
    const bw = plotW / 7;
    const yOf = (v) => padT + plotH - (v / top) * plotH;
    const grid = [];
    for (let v = 0; v <= top; v += top / 4) grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - 6}" y2="${f1(yOf(v))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${fmt1(v / 1000)}k</text>`);
    const bars = days.map((d, i) => {
      const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
      const color = d.name === r.weakest ? css('--c7') : d.name === r.strongest ? css('--ok') : css('--c2');
      const bar = isNum(d.avg)
        ? `<rect x="${f1(x)}" y="${f1(yOf(d.avg))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(d.avg))}" rx="2" fill="${color}"><title>${d.name}: ${fmtInt(d.avg)} a day over ${d.count} days, goal met ${d.goalDays} times</title></rect>
           <text class="t-val" x="${f1(x + w / 2)}" y="${f1(yOf(d.avg) - 3)}" text-anchor="middle" font-size="9" fill="${css('--c8')}">${fmt1(d.avg / 1000)}k</text>`
        : '';
      return `${bar}<text class="t-tick" x="${f1(x + w / 2)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${sentence(d.name)}</text>`;
    }).join('');
    // The average is a dashed line only; its number is in the note below (a label here collides with the bar labels).
    const avg = isNum(r.overallAvg) ? `<line x1="${padL}" y1="${f1(yOf(r.overallAvg))}" x2="${W - 6}" y2="${f1(yOf(r.overallAvg))}" stroke="${css('--c3')}" stroke-width="1.5" stroke-dasharray="5 4"><title>All days: ${fmtInt(r.overallAvg)} a day</title></line>` : '';
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="average steps per weekday">${grid.join('')}${avg}${bars}</svg>`;
  }

  /** 1.4: 90 days of resting pulse as dots, the 7-day average as a line, the 90-day average dashed. */
  function drawRestingTrend(host, t, today) {
    const W = 420, H = 150, padL = 30, padR = 8, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const points = t.points || [];
    if (!points.length) { host.innerHTML = emptySvg(W, H, 'No pulse data yet'); return; }
    const end = new Date(today + 'T00:00:00');
    const start = new Date(end.getTime() - (t.days || 90) * 86400000);
    const xOf = (iso) => padL + Math.min(1, Math.max(0, (new Date(iso + 'T00:00:00') - start) / (end - start))) * plotW;
    const vals = points.map((p) => p.bpm);
    const lo = Math.floor((Math.min(...vals) - 3) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
    const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
    const grid = [];
    const gridStep = hi - lo > 20 ? 10 : 5;
    for (let v = lo; v <= hi; v += gridStep) grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
    const months = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDate() === 1) months.push(`<text class="t-tick" x="${f1(xOf(d.toLocaleDateString('sv-SE')))}" y="${H - 5}" font-size="9" fill="${css('--dim')}">${MONTHS[d.getMonth()]}</text>`);
    }
    const dots = points.map((p) => `<circle cx="${f1(xOf(p.date))}" cy="${f1(yOf(p.bpm))}" r="2.3" fill="${css('--c7')}" opacity=".75"><title>${p.date}: ${p.bpm} bpm</title></circle>`).join('');
    const avgPath = (t.avg7 || []).map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p.date))} ${f1(yOf(p.bpm))}`).join(' ');
    const avgLine = isNum(t.avg) ? `<line x1="${padL}" y1="${f1(yOf(t.avg))}" x2="${W - padR}" y2="${f1(yOf(t.avg))}" stroke="${css('--c3')}" stroke-width="1.5" stroke-dasharray="5 4"/><text class="t-mark" x="${W - padR - 2}" y="${f1(yOf(t.avg) - 4)}" text-anchor="end" font-size="9" fill="${css('--c3')}">90-day avg ${t.avg}</text>` : '';
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="resting pulse over 90 days">${grid.join('')}${months.join('')}${avgLine}<path d="${avgPath}" fill="none" stroke="${css('--c8')}" stroke-width="2" stroke-linejoin="round"/>${dots}</svg>`;
  }

  /** 1.4: seven days of water against the goal. */
  function drawHydrationDays(host, days, goalMl) {
    const W = 200, H = 80, padL = 4, padB = 14, padT = 10;
    const plotW = W - padL - 4, plotH = H - padB - padT;
    const list = days || [];
    const top = Math.max(500, goalMl || 0, ...list.map((d) => d.ml || 0));
    const bw = plotW / Math.max(1, list.length);
    const yOf = (v) => padT + plotH - (v / top) * plotH;
    const bars = list.map((d, i) => {
      const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      const g = d.goalMl ?? goalMl;
      const bar = d.ml > 0 ? `<rect x="${f1(x)}" y="${f1(yOf(d.ml))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(d.ml))}" rx="2" fill="${d.ml >= (g || Infinity) ? css('--ok') : css('--c5')}"><title>${d.date}: ${fmt1(d.ml / 1000)} l</title></rect>` : '';
      const goal = isNum(g) ? `<line x1="${f1(x - 2)}" y1="${f1(yOf(g))}" x2="${f1(x + w + 2)}" y2="${f1(yOf(g))}" stroke="${css('--c8')}" stroke-width="1.5"/>` : '';
      return `${bar}${goal}<text class="t-tick" x="${f1(x + w / 2)}" y="${H - 3}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${weekdayOf(d.date)[0]}</text>`;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="water over seven days"><line x1="${padL}" y1="${f1(padT + plotH)}" x2="${W - 4}" y2="${f1(padT + plotH)}" class="gridline"/>${bars}</svg>`;
  }

  /** 1.4: 28 days of average stress, coloured by Garmin's bands, with the 4-week average dashed. */
  function drawStressDays(host, days, avg28, today) {
    const W = 420, H = 110, padL = 26, padB = 16, padT = 8;
    const plotW = W - padL - 6, plotH = H - padB - padT;
    const list = days || [];
    if (!list.some((d) => isNum(d.avg))) { host.innerHTML = emptySvg(W, H, 'No stress readings yet'); return; }
    const bw = plotW / Math.max(1, list.length);
    const yOf = (v) => padT + plotH - (Math.min(100, v) / 100) * plotH;
    const bandColor = (v) => (v < 25 ? css('--c5') : v < 50 ? css('--c6') : v < 75 ? css('--c1') : css('--c7'));
    const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - 6}" y2="${f1(yOf(v))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`).join('');
    const bars = list.map((d, i) => {
      const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      const bar = isNum(d.avg) ? `<rect x="${f1(x)}" y="${f1(yOf(d.avg))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(d.avg))}" rx="1.5" fill="${bandColor(d.avg)}" opacity="${d.date === today ? 1 : 0.8}"><title>${d.date}: average ${d.avg}${isNum(d.max) ? `, peak ${d.max}` : ''}</title></rect>` : '';
      const label = i % 7 === 0 || d.date === today ? `<text class="t-tick" x="${f1(x + w / 2)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${d.date === today ? css('--c6') : css('--dim')}">${Number(d.date.slice(8))}</text>` : '';
      return bar + label;
    }).join('');
    const avg = isNum(avg28) ? `<line x1="${padL}" y1="${f1(yOf(avg28))}" x2="${W - 6}" y2="${f1(yOf(avg28))}" stroke="${css('--c3')}" stroke-width="1.5" stroke-dasharray="5 4"/><text class="t-mark" x="${W - 8}" y="${f1(yOf(avg28) - 4)}" text-anchor="end" font-size="9" fill="${css('--c3')}">4-week avg ${avg28}</text>` : '';
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="average stress per day">${grid}${avg}${bars}</svg>`;
  }

  /** Heart rate over a workout with the altitude as a soft area behind it. */
  function drawHrCurve(host, hr, altitude) {
    const W = 520, H = 200, padL = 30, padR = 30, padT = 10, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!hr.length && !altitude.length) { host.innerHTML = emptySvg(W, H, 'No heart-rate curve in the file'); return; }
    const maxT = Math.max(1, ...hr.map((p) => p[0]), ...altitude.map((p) => p[0]));
    const xOf = (t) => padL + (t / maxT) * plotW;
    let area = '';
    if (altitude.length) {
      const alts = altitude.map((p) => p[1]);
      const aLo = Math.min(...alts), aHi = Math.max(...alts);
      const yA = (a) => padT + plotH - ((a - aLo) / (aHi - aLo || 1)) * plotH * 0.8;
      area = `<path d="M ${f1(xOf(altitude[0][0]))} ${padT + plotH} ${altitude.map((p) => `L ${f1(xOf(p[0]))} ${f1(yA(p[1]))}`).join(' ')} L ${f1(xOf(altitude[altitude.length - 1][0]))} ${padT + plotH} Z" fill="${css('--c6')}" opacity=".18"/>
              <text class="t-mark" x="${W - padR + 2}" y="${f1(yA(aHi) + 3)}" font-size="9" fill="${css('--c6')}">${Math.round(aHi)} m</text><text class="t-mark" x="${W - padR + 2}" y="${f1(yA(aLo) + 3)}" font-size="9" fill="${css('--c6')}">${Math.round(aLo)} m</text>`;
    }
    let line = '';
    if (hr.length) {
      const vals = hr.map((p) => p[1]);
      const lo = Math.floor((Math.min(...vals) - 5) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
      const yOf = (v) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
      const grid = [];
      for (let v = lo; v <= hi; v += 10) grid.push(`<line x1="${padL}" y1="${f1(yOf(v))}" x2="${W - padR}" y2="${f1(yOf(v))}" class="gridline"/><text class="t-tick" x="${padL - 4}" y="${f1(yOf(v) + 3)}" text-anchor="end" font-size="9" fill="${css('--dim')}">${v}</text>`);
      line = `${grid.join('')}<path d="${hr.map((p, i) => `${i ? 'L' : 'M'} ${f1(xOf(p[0]))} ${f1(yOf(p[1]))}`).join(' ')}" fill="none" stroke="${css('--c7')}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    const ticks = [];
    const stepMin = maxT > 7200 ? 30 : maxT > 3600 ? 15 : maxT > 1200 ? 5 : 1;
    for (let t = 0; t <= maxT; t += stepMin * 60) ticks.push(`<text class="t-tick" x="${f1(xOf(t))}" y="${H - 5}" text-anchor="middle" font-size="9" fill="${css('--dim')}">${Math.round(t / 60)}'</text>`);
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="heart rate over the workout">${area}${line}${ticks.join('')}</svg>`;
  }

  /** The GPS trace, drawn to fit the box. */
  function drawTrace(host, trace) {
    const W = 300, H = 220, pad = 12;
    if (trace.length < 2) { host.innerHTML = emptySvg(W, H, 'No GPS trace'); return; }
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
    $('week-number').textContent = `Week ${isoWeek(now)}`;
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
  const PLAN_KEYS = ['runs', 'strength', 'swims', 'rides', 'hikes', 'walks', 'yoga'];
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
      big: fmtInt(t.steps), unit: 'steps',
      small: isNum(t.stepGoal) ? `${Math.round(((t.steps || 0) / t.stepGoal) * 100)} % of goal` : 'No goal set',
    });
    setText('steps-value', fmtInt(t.steps));
    setText('steps-goal', fmtInt(t.stepGoal));
    renderStepsChip(t.stepsCompare);
    setText('distance-value', fmtKm(t.distanceM));

    const bb = t.bodyBattery || {};
    drawThermo($('body-battery-bar'), {
      value: bb.latest, lo: 0, hi: 100, step: 20, color: css('--c5'), label: 'BODY BATTERY',
      markers: [{ value: bb.max, label: 'High', color: css('--c6') }, { value: bb.min, label: 'Low', color: css('--c7') }],
    });
    setText('bb-charged', isNum(bb.charged) ? `+${bb.charged}` : '—');
    setText('bb-drained', isNum(bb.drained) ? `−${bb.drained}` : '—');

    drawDial($('resting-hr'), {
      value: t.restingHr, lo: 40, hi: 100, color: css('--c7'), label: 'resting', unit: 'bpm',
      zones: [{ from: 40, to: 55, color: css('--c5') }, { from: 55, to: 70, color: css('--c6') }, { from: 70, to: 100, color: css('--c7') }],
    });
    setText('hr-min', isNum(t.minHr) ? `${t.minHr}` : '—');
    setText('hr-max', isNum(t.maxHr) ? `${t.maxHr}` : '—');
    setText('hr-month-avg', isNum(b.month?.restingHrAvg) ? `${b.month.restingHrAvg}` : '—');

    drawHBar($('stress-bar'), {
      value: t.stressAvg, marker: t.stressMax, markerLabel: isNum(t.stressMax) ? `max ${t.stressMax}` : '', label: 'stress',
      segments: [{ from: 0, to: 25, color: css('--c5') }, { from: 25, to: 50, color: css('--c6') }, { from: 50, to: 75, color: css('--c1') }, { from: 75, to: 100, color: css('--c7') }],
    });
    setText('stress-avg', isNum(t.stressAvg) ? `${t.stressAvg}` : 'UNKNOWN');
    setText('stress-max', isNum(t.stressMax) ? `${t.stressMax}` : '—');
    setText('respiration-value', isNum(t.respirationAvg) ? `${t.respirationAvg} / min` : '—');

    const week = b.week || {};
    drawArcGauge($('intensity-gauge'), {
      value: week.intensityMinutes, max: week.goal, color: css('--c1'),
      big: fmtInt(week.intensityMinutes), unit: 'minutes',
      small: isNum(week.goal) ? `${Math.round(((week.intensityMinutes || 0) / week.goal) * 100)} % of weekly goal` : 'No goal set',
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
    const strip = $('sleep-strip');
    strip.hidden = !s.recorded;
    if (!s.recorded) {
      host.innerHTML = `<div class="nodata">No sleep data<small>Wear the watch at night — the night appears here in the morning</small></div>`;
      return;
    }
    const bed = s.start ? fmtClock(new Date(s.start), undefined, false) : '—';
    const up = s.end ? fmtClock(new Date(s.end), undefined, false) : '—';
    strip.classList.toggle('first', !!s.firstNight);
    strip.textContent = s.firstNight
      ? `FIRST NIGHT WITH THE WATCH · WELL DONE · BED ${bed} · UP ${up}`
      : `LAST NIGHT · BED ${bed} · UP ${up}${s.qualifier ? ` · ${s.qualifier}` : ''}`;
    const total = (s.deepSeconds || 0) + (s.lightSeconds || 0) + (s.remSeconds || 0) + (s.awakeSeconds || 0) || s.seconds || 1;
    const pct = (v) => `${((v || 0) / total) * 100}%`;
    const parts = [['Deep', s.deepSeconds, css('--c4')], ['Light', s.lightSeconds, css('--c5')], ['REM', s.remSeconds, css('--c3')], ['Awake', s.awakeSeconds, css('--c7')]];
    host.innerHTML = `
      <div class="big-row">
        <div class="big"><span class="v">${fmtHours(s.seconds)}</span><span class="k">Asleep</span></div>
        <div class="big"><span class="v">${isNum(s.score) ? s.score : '—'}</span><span class="k">Sleep score</span></div>
      </div>
      <div class="stack">${parts.map(([, v, c]) => `<span style="width:${pct(v)};background:${c}"></span>`).join('')}</div>
      <div class="legend">${parts.map(([k, v, c]) => `<span><i style="background:${c}"></i>${k} ${fmtHours(v)}</span>`).join('')}</div>
      <div class="kv-row">
        <div class="kv"><span class="k">Bedtime</span><span class="v">${s.start ? fmtClock(new Date(s.start), undefined, false) : '—'}</span></div>
        <div class="kv"><span class="k">Wake</span><span class="v">${s.end ? fmtClock(new Date(s.end), undefined, false) : '—'}</span></div>
        ${isNum(s.needMinutes) ? `<div class="kv"><span class="k">Need</span><span class="v">${fmtMin(s.needMinutes)}</span></div>` : ''}
      </div>`;
  }

  function renderHrv(b) {
    const h = b.hrv || {};
    const host = $('hrv-body');
    if (!h.recorded) {
      host.innerHTML = `<div class="nodata">No HRV data<small>Recorded overnight, with the watch on</small></div>`;
      return;
    }
    host.innerHTML = `
      <div class="big-row"><div class="big"><span class="v">${h.lastNight}</span><span class="k">Last night · ms</span></div></div>
      <div class="kv-row">
        <div class="kv"><span class="k">7-day avg</span><span class="v">${isNum(h.weeklyAvg) ? h.weeklyAvg : '—'}</span></div>
        <div class="kv"><span class="k">Status</span><span class="v">${escapeHtml(h.status || '—').replace(/_/g, ' ')}</span></div>
        <div class="kv"><span class="k">Baseline</span><span class="v">${isNum(h.baselineLow) && isNum(h.baselineHigh) ? `${h.baselineLow}–${h.baselineHigh}` : '—'}</span></div>
      </div>`;
  }

  function renderSleepDebt(b) {
    const d = b.sleepDebt || { recorded: false, nights: [] };
    const nudge = $('sleep-nudge');
    nudge.hidden = d.missingRecent !== 3;
    nudge.textContent = d.missingRecent === 3 ? 'Wear the watch tonight · the last 3 nights are empty' : '';
    if (!d.recorded) {
      setText('sleep-debt-value', 'No nights yet');
      setText('sleep-debt-note', d.missingRecent === 3 ? 'Wear the watch tonight · 3 empty nights' : 'Fills once the watch is worn at night');
      $('sleep-debt-chart').innerHTML = '';
      return;
    }
    const debt = d.debtMin;
    setText('sleep-debt-value', `${debt > 0 ? '−' : '+'}${fmtMin(Math.abs(debt))}`);
    if (d.missingRecent === 3) setText('sleep-debt-note', 'Wear the watch tonight · 3 empty nights');
    else setText('sleep-debt-note', debt > 0 ? `Short of your need · ${d.nights.filter((n) => n.recorded).length} nights counted` : `Ahead of your need · ${d.nights.filter((n) => n.recorded).length} nights counted`);
    drawSleepDebt($('sleep-debt-chart'), d.nights);
  }

  function renderWeight(b) {
    const w = b.weight;
    const kg = w?.kg;
    const base = isNum(kg) ? Math.floor((kg - 4) / 2) * 2 : 70;
    const trend = b.weightTrend || { points: [], avg7: [], goalKg: null };
    drawThermo($('weight-thermo'), {
      value: kg, lo: base, hi: base + 10, step: 2, color: css('--c6'), unit: 'kg', label: 'weight', decimals: 1,
      markers: isNum(trend.goalKg) && trend.goalKg >= base && trend.goalKg <= base + 10 ? [{ value: trend.goalKg, label: 'Goal', color: css('--c3') }] : [],
    });
    setText('weight-date', w?.date ? fmtDay(w.date) : 'No weigh-in');
    setText('weight-delta', isNum(w?.deltaKg) ? `${w.deltaKg > 0 ? '+' : w.deltaKg < 0 ? '−' : ''}${Math.abs(w.deltaKg).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg` : '—');
    setText('weight-goal', isNum(trend.goalKg) ? fmtKg(trend.goalKg) : '—');
    drawWeightTrend($('weight-trend-chart'), trend, b.date);
  }

  function renderBbCurve(b) {
    const c = b.bodyBatteryCurve || { points: [], events: [] };
    drawCurve($('bb-curve-chart'), c.points, c.events, c.workouts || []);
    setText('bb-curve-note', c.points.length ? `${c.points.length} readings` : '');
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
    if (v.date) notes.push(`VO2 max from ${fmtDay(v.date)}${isNum(v.prev) ? ` (before ${fmt1(v.prev)})` : ''}`);
    else notes.push('VO2 max: not shared by Garmin\'s personal API yet');
    if (isNum(a.value) && isNum(a.chronological)) notes.push(`${Math.round(a.chronological - a.value)} years younger than the calendar`);
    setText('fitness-note', notes.join(' · '));
  }

  function renderTraining(b) {
    const t = b.training || {};
    const chip = $('training-status');
    chip.textContent = t.status || '—';
    chip.classList.toggle('warn', t.status === 'OVERREACHING');
    drawHBar($('training-load-bar'), {
      value: isNum(t.ratio) ? Math.min(2, t.ratio) : null, max: 2, fillColor: css('--c1'), label: 'training ratio',
      marker: 1, markerLabel: 'balanced',
      segments: [{ from: 0, to: 0.8, color: css('--c5') }, { from: 0.8, to: 1.0, color: css('--c6') }, { from: 1.0, to: 1.3, color: css('--ok') }, { from: 1.3, to: 2, color: css('--c7') }],
    });
    setText('training-acute', isNum(t.acute) ? fmtInt(t.acute) : '—');
    setText('training-chronic', isNum(t.chronic) ? fmtInt(t.chronic) : '—');
    setText('training-ratio', isNum(t.ratio) ? t.ratio.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
  }

  const weekdayOf = (iso) => DAY_NAMES[new Date(iso + 'T12:00:00').getDay()];
  /** Today against the same weekday four weeks ago. */
  function renderStepsChip(c) {
    const el = $('steps-chip');
    el.classList.remove('up', 'down');
    if (!c || !isNum(c.steps)) { el.textContent = '—'; el.title = 'No steps recorded on the same weekday four weeks ago'; return; }
    const d = c.delta || 0;
    const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '▶';
    if (d > 0) el.classList.add('up'); else if (d < 0) el.classList.add('down');
    el.innerHTML = `${arrow} ${d > 0 ? '+' : ''}${fmtInt(d)}${isNum(c.pct) ? ` (${c.pct > 0 ? '+' : c.pct < 0 ? '−' : ''}${Math.abs(c.pct)} %)` : ''}<small>${weekdayOf(c.date)} ${fmtDay(c.date)} · ${fmtInt(c.steps)}</small>`;
    el.title = `Today ${fmtInt((c.steps || 0) + d)} steps against ${fmtInt(c.steps)} on ${fmtDay(c.date)}, the same weekday four weeks ago`;
  }

  function renderZones(b) {
    const z = b.zones || { secondsInZone: [0, 0, 0, 0, 0], total: 0, floors: [], maxHr: null };
    const last7 = z.period === 'last7';
    setText('zones-total', z.total ? fmtDur(z.total) : '—');
    setText('zones-total-label', last7 ? 'In zones · last 7 days' : 'In zones this week');
    setText('zones-note', last7 ? 'Last 7 days · no workout yet this week' : '');
    drawZones($('zones-chart'), z);
  }

  function renderStreaks(b) {
    const s = b.streaks || {};
    const days = (n) => (isNum(n) ? `${n} ${n === 1 ? 'day' : 'days'}` : '—');
    const best = (x) => (x && isNum(x.longest) ? `${days(x.longest)}${x.longestEnd ? ` <small>to ${fmtDay(x.longestEnd)}</small>` : ''}` : '—');
    setText('streak-steps-current', days(s.stepGoal?.current));
    $('streak-steps-longest').innerHTML = best(s.stepGoal);
    setText('streak-workout-current', days(s.workouts?.current));
    $('streak-workout-longest').innerHTML = best(s.workouts);
  }

  function renderYear(b) {
    const y = b.year || { months: [] };
    const ly = b.lastYear || null;
    const lyMonths = new Map((ly?.months || []).map((m) => [m.ym.slice(5, 7), m]));
    const current = b.date.slice(0, 7);
    const maxSteps = Math.max(1, ...y.months.map((m) => m.steps), ...(ly?.months || []).map((m) => m.steps));
    for (const m of y.months) {
      const mm = m.ym.slice(5, 7);
      const tile = $(`year-tile-${mm}`);
      if (!tile) continue;
      const future = m.ym > current;
      const lm = lyMonths.get(mm);
      const hasLy = !!(lm && lm.daysWithData > 0);
      tile.className = `tile${future ? ' future' : ''}${m.ym === current ? ' current' : ''}`;
      tile.innerHTML = `<span class="tm">${MONTHS[Number(mm) - 1]}</span>
        <span class="tv">${future ? '—' : fmtInt(m.steps)}</span><span class="tk">steps</span>
        <span class="tbar"><i style="width:${Math.round((m.steps / maxSteps) * 100)}%"></i></span>
        <span class="tbar ghost" title="${ly ? `${ly.year}: ${hasLy ? fmtInt(lm.steps) + ' steps' : 'no data'}` : ''}"><i style="width:${hasLy ? Math.round((lm.steps / maxSteps) * 100) : 0}%"></i></span>
        <span class="tk ly" id="year-last-${mm}">${hasLy ? `${ly.year} · ${fmtInt(lm.steps)} · ${lm.workouts} workouts` : (ly ? `${ly.year} · —` : '—')}</span>
        <span class="tv">${future ? '—' : m.workouts}</span><span class="tk">workouts · ${fmtDur(m.trainingSeconds)}</span>
        <span class="tv">${isNum(m.restingHrAvg) ? m.restingHrAvg : '—'}</span><span class="tk">resting · ${m.stepGoalDays} goal days</span>`;
      tile.style.cursor = future ? 'default' : 'pointer';
      tile.onclick = future ? null : () => showMonth(m.ym === current ? null : m.ym);
    }
    const totalSteps = y.months.reduce((a, m) => a + m.steps, 0);
    const totalWorkouts = y.months.reduce((a, m) => a + m.workouts, 0);
    setText('year-note', `${y.year} · ${fmtInt(totalSteps)} steps · ${totalWorkouts} workouts · ${fmtDur(y.months.reduce((a, m) => a + m.trainingSeconds, 0))}`);
    setText('last-year-line', lastYearLine(ly, b));
    const label = $('explain-year');
    if (label) label.textContent = `THE YEAR ${y.year}`;
  }

  /** "SAME TIME LAST YEAR": last year's number, then this year's, with the change. */
  function lastYearLine(ly, b) {
    if (!ly) return '—';
    const m = ly.month || {}, t = ly.toDate || {};
    const change = (v, unit) => (!isNum(v) ? '' : v === 0 ? ' (=)' : ` (${v > 0 ? '▲ +' : '▼ −'}${Math.abs(v)}${unit})`);
    const pair = (blk, fmt, unit) => `${fmt(blk.before)} → ${fmt(blk.now)}${change(isNum(blk.pct) ? blk.pct : blk.diff, isNum(blk.pct) ? ' %' : unit)}`;
    const name = m.ym ? monthWord(m.ym) : '';
    const parts = [];
    if (m.available) {
      parts.push(`Same time last year · ${name} ${ly.year} to day ${m.throughDay} · steps ${pair(m.steps, fmtInt, '')} · workouts ${pair(m.workouts, (n) => n, '')}${isNum(m.restingHrAvg?.before) && isNum(m.restingHrAvg?.now) ? ` · resting ${m.restingHrAvg.before} → ${m.restingHrAvg.now}${change(m.restingHrAvg.diff, '')}` : ''}`);
    } else {
      parts.push(`No data for ${name} ${ly.year} · nothing to compare with yet`);
    }
    if (t.available) parts.push(`${ly.year} to this day · steps ${pair(t.steps, fmtInt, '')} · workouts ${pair(t.workouts, (n) => n, '')} · training ${pair(t.trainingSeconds, fmtDur, '')}`);
    return parts.join('   ·   ');
  }

  // ----- the 1.4 panels: plan, rhythm, resting trend, stress, water -----

  function renderPlan(b) {
    const p = b.plan || { items: [], target: 0, done: 0 };
    const items = p.items || [];
    $('plan-list').innerHTML = items.length
      ? items.map((it) => {
        const ticks = [];
        for (let i = 0; i < it.target; i++) ticks.push(i < it.done ? '<span class="tick">●</span>' : '<span class="open">○</span>');
        if (it.done > it.target) ticks.push(`<small>+${it.done - it.target}</small>`);
        return `<div class="plan-row${it.done >= it.target ? ' done' : ''}" id="plan-row-${escapeHtml(it.key)}" title="${escapeHtml((it.dates || []).map(fmtDay).join(', '))}">
          <span class="pk">${escapeHtml(sentence(it.label))}</span><span class="ticks">${ticks.join('')}</span><span class="pv">${it.done} / ${it.target}</span></div>`;
      }).join('')
      : '<div class="act-empty">No plan yet. How many runs, strength sessions or swims a week?</div>';
    const left = p.daysLeft === 0 ? 'last day of the week' : `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left`;
    setText('plan-note', !p.target ? 'No plan set · Edit to add one' : p.complete ? `All done · ${left}` : `${p.done} of ${p.target} done · ${left}`);
  }

  function renderRhythm(b) {
    const r = b.rhythm || { days: [] };
    drawRhythm($('rhythm-chart'), r);
    const by = new Map((r.days || []).map((d) => [d.name, d]));
    const dayWord = (n) => ({ MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' }[n] || n);
    setText('rhythm-note', r.weakest
      ? `Weakest ${dayWord(r.weakest)} · ${fmtInt(by.get(r.weakest)?.avg)} a day · strongest ${dayWord(r.strongest)} · ${fmtInt(by.get(r.strongest)?.avg)}${isNum(r.overallAvg) ? ` · all days ${fmtInt(r.overallAvg)}` : ''}`
      : 'No days with data yet');
  }

  function renderRestingTrend(b) {
    const t = b.restingTrend || { points: [], avg7: [] };
    drawRestingTrend($('resting-trend-chart'), t, b.date);
    setText('resting-trend-note', t.points?.length
      ? `Avg ${t.avg} · ${t.min}–${t.max}${t.latest ? ` · latest ${t.latest.bpm} on ${fmtDay(t.latest.date)}` : ''}${t.avg7?.length ? ` · 7-day avg ${fmt1(t.avg7[t.avg7.length - 1].bpm)}` : ''}`
      : 'No pulse data yet');
  }

  function renderStress(b) {
    const s = b.stress || { today: {}, days: [] };
    const t = s.today || {};
    const chip = $('stress-word');
    chip.textContent = t.qualifier || '—';
    chip.classList.toggle('warn', /STRESSFUL/.test(t.qualifier || ''));
    const parts = [['Rest', t.restSec, css('--c5')], ['Low', t.lowSec, css('--c6')], ['Medium', t.mediumSec, css('--c1')], ['High', t.highSec, css('--c7')]];
    const total = t.measuredSec || 0;
    $('stress-stack').innerHTML = total
      ? parts.map(([k, v, c]) => `<span style="width:${((v || 0) / total) * 100}%;background:${c}" title="${k} ${fmtDur(v || 0)}"></span>`).join('')
      : '';
    $('stress-legend').innerHTML = total
      ? parts.map(([k, v, c]) => `<span><i style="background:${c}"></i>${k} ${fmtDur(v || 0)}</span>`).join('')
      : '<span>No stress levels measured yet today</span>';
    drawStressDays($('stress-days-chart'), s.days || [], s.avg28, b.date);
    setText('stress-note', `${isNum(t.avg) ? `Today ${t.avg}` : 'Today —'}${isNum(t.max) ? ` · peak ${t.max}` : ''}${isNum(s.avg28) ? ` · 4-week avg ${s.avg28}` : ''} · under 25 is rest, over 75 is high`);
  }

  function renderHydration(b) {
    const h = b.hydration || { logged: false, days: [] };
    const litres = (ml) => (isNum(ml) ? fmt1(ml / 1000) : '—');
    drawArcGauge($('hydration-gauge'), {
      value: h.todayMl, max: h.goalMl, color: css('--c5'),
      big: litres(h.todayMl), unit: 'litres',
      small: isNum(h.pct) ? `${h.pct} % of goal` : (isNum(h.goalMl) ? `Goal ${litres(h.goalMl)} l` : 'No goal set'),
    });
    drawHydrationDays($('hydration-days'), h.days || [], h.goalMl);
    setText('hydration-note', h.logged
      ? `${isNum(h.goalMl) ? `Goal ${litres(h.goalMl)} l · ` : ''}7-day avg ${litres(h.avgMl)} l${h.lastEntryAt ? ` · last entry ${fmtStamp(h.lastEntryAt)}` : ''}`
      : 'No water logged · log it in Garmin Connect or on the watch');
  }

  function renderTravel(travel) {
    const row = $('travel-row');
    row.hidden = !travel;
    setText('chrono-note', travel ? 'Away' : '');
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
    if (value === 0) { el.textContent = '= last month'; return; }
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
    setText('month-label', isCurrent ? `${monthLong(ym)} · so far` : monthLong(ym));
    $('month-next').disabled = isCurrent;
    $('month-today').hidden = isCurrent;

    drawBars($('month-steps-chart'), days, { color: css('--c2'), todayColor: css('--c6'), goalColor: css('--c8'), today: board.date, logDays });
    const finishedDays = isCurrent ? Math.max(0, (m.daysWithData ?? 0) - 1) : (m.daysWithData ?? 0);
    setText('month-steps-note', `${fmtInt(m.steps)} steps · goal met ${m.stepGoalDays ?? 0}/${finishedDays} days`);
    drawLine($('month-hr-chart'), days, { color: css('--c7'), avg: m.restingHrAvg, avgColor: css('--c8'), today: board.date });
    setText('month-hr-note', isNum(m.restingHrMin) ? `${m.restingHrMin}–${m.restingHrMax} bpm` : '');

    setText('total-steps', fmtInt(m.steps));
    setText('total-avg-steps', fmtInt(m.avgSteps));
    setText('total-goal-days', `${m.stepGoalDays ?? 0} days`);
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
    setText('compare-note', c.previousMonth ? `vs ${monthWord(c.previousMonth)} to day ${c.throughDay}` : '');

    renderActivities(a);
    renderTargets(board.targets || {}, m, a, ym, isCurrent);
    renderLog(md.log || {}, ym);
  }

  function renderActivities(a) {
    const list = a.list || [];
    setText('activities-total', list.length
      ? `${a.count} workouts · ${fmtDur(a.seconds)} · ${fmtKm(a.distanceM)} · ${fmtInt(a.calories)} kcal · ${fmtInt(a.elevationGain)} m climbed · click one for the detail`
      : 'No workouts yet this month');
    $('activities-list').innerHTML = list.length
      ? list.map((x) => {
        const tag = typeTag(x.type);
        return `<div class="act" id="act-${escapeHtml(x.id)}" data-id="${escapeHtml(x.id)}" role="button" tabindex="0">
          <span class="tag" style="background:${tag.color}">${escapeHtml(tag.text)}</span>
          <span class="when">${fmtWhen(x.start)}</span>
          <span class="name" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</span>
          <span class="num n-dur">${fmtDur(x.seconds)}</span>
          <span class="num n-dist">${x.distanceM > 0 ? fmtKm(x.distanceM) : '—'}</span>
          <span class="num n-hr">${isNum(x.avgHr) ? `${x.avgHr} bpm` : '—'}</span>
          <span class="te">${escapeHtml(sentence(x.trainingEffect || ''))}${isNum(x.aerobic) ? ` · TE ${x.aerobic.toFixed(1)}` : ''}</span>
        </div>`;
      }).join('')
      : '<div class="act-empty">The log is empty. Go move.</div>';
  }

  // ---------- 1.8.0 Workouts: today / yesterday / last 7 days, beside Body Battery ----------
  const WORKOUTS_KEY = 'ams-garmin-board.workoutsRange';
  const WORKOUT_RANGES = ['today', 'yesterday', 'last7'];
  const WORKOUT_EMPTY = { today: 'No workouts today', yesterday: 'No workouts yesterday', last7: 'No workouts in the last 7 days' };
  let workoutsRange = (() => {
    try { const v = localStorage.getItem(WORKOUTS_KEY); return WORKOUT_RANGES.includes(v) ? v : 'today'; } catch { return 'today'; }
  })();
  function renderWorkouts(b) {
    for (const r of WORKOUT_RANGES) $(`workouts-tab-${r}`).setAttribute('aria-pressed', String(r === workoutsRange));
    const p = b?.recentWorkouts?.[workoutsRange];
    const list = p?.list || [];
    setText('workouts-summary', list.length
      ? [`${p.count} ${p.count === 1 ? 'workout' : 'workouts'}`, fmtDur(p.seconds), p.distanceM > 0 ? fmtKm(p.distanceM) : null, isNum(p.calories) && p.calories > 0 ? `${fmtInt(p.calories)} kcal` : null].filter(Boolean).join(' · ')
      : WORKOUT_EMPTY[workoutsRange]);
    // 1.9.0: on the 7-day tab, a line comparing with the 7 days before.
    const cmp = $('workouts-compare');
    const v = b?.recentWorkouts?.vsLastWeek, prev = b?.recentWorkouts?.prev7;
    if (workoutsRange === 'last7' && v && prev && (p?.count || prev.count)) {
      const sg = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±');
      const parts = [`${sg(v.count)}${Math.abs(v.count)} ${Math.abs(v.count) === 1 ? 'workout' : 'workouts'}`, `${sg(v.seconds)}${fmtDur(Math.abs(v.seconds))}`];
      if (v.distanceM !== 0) parts.push(`${sg(v.distanceM)}${fmtKm(Math.abs(v.distanceM))}`);
      cmp.textContent = `vs the 7 days before: ${parts.join(' · ')}`;
      cmp.hidden = false;
    } else { cmp.textContent = ''; cmp.hidden = true; }
    const when = (x) => {
      const d = parseLocal(x.start);
      if (!d) return '—';
      const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      return workoutsRange === 'last7' ? `${DAY_NAMES[d.getDay()]} ${hm}` : hm;
    };
    $('workouts-list').innerHTML = list.map((x) => {
      const tag = typeTag(x.type);
      return `<div class="act" id="wk-act-${escapeHtml(x.id)}" data-id="${escapeHtml(x.id)}" role="button" tabindex="0">
        <span class="tag" style="background:${tag.color}">${escapeHtml(tag.text)}</span>
        <span class="when">${when(x)}</span>
        <span class="name" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</span>
        <span class="num n-dur">${fmtDur(x.seconds)}</span>
        <span class="num n-dist">${x.distanceM > 0 ? fmtKm(x.distanceM) : '—'}</span>
      </div>`;
    }).join('');
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
    setText('targets-note', shown ? `Day ${day} of ${total} · ${Math.round((day / total) * 100)} % of the month gone` : 'No targets set · Edit to add some');
  }

  function renderLog(entries, ym) {
    const today = board.date;
    const input = $('log-today-input');
    if (document.activeElement !== input) input.value = entries[today] ?? (board.log?.[today] ?? '');
    const dates = Object.keys(entries).sort().reverse();
    $('log-list').innerHTML = dates.length
      ? dates.map((d) => `<div class="log-line" id="log-line-${d}"><span class="d">${fmtDay(d)}</span><span class="t" title="${escapeHtml(entries[d])}">${escapeHtml(entries[d])}</span></div>`).join('')
      : `<div class="act-empty">No lines in ${monthWord(ym)} yet. How was today?</div>`;
    setText('log-note', dates.length ? `${dates.length} ${dates.length === 1 ? 'line' : 'lines'}` : '');
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
      setText('weather-place', 'Weather unavailable');
      setText('weather-text', String(err.message || err));
    }
    $('weather-locate-button').textContent = loc ? 'AUTO' : 'LOCATE';
  }
  function renderWeather(w) {
    const src = { browser: 'this device', workout: 'latest workout', home: 'home' }[w.place?.source] || '';
    setText('weather-place', `${w.place?.name || '—'} · ${src}`);
    setText('weather-temp', isNum(w.now?.tempC) ? `${Math.round(w.now.tempC)}°` : '—');
    setText('weather-text', w.now?.text || '—');
    setText('weather-wind', isNum(w.now?.windKmh) ? `${Math.round(w.now.windKmh)} km/h` : '—');
    setText('weather-rain', isNum(w.now?.precipMm) ? `${w.now.precipMm.toLocaleString(LOCALE)} mm` : '—');
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
    renderPlan(b);
    renderRhythm(b);
    renderRestingTrend(b);
    renderStress(b);
    renderHydration(b);
    renderWorkouts(b);
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
      const p = j.settings?.plan || {};
      for (const k of PLAN_KEYS) $(`plan-${k}`).value = p[k] ?? '';
      $('notify-toggle').checked = j.settings?.notify !== false;
      $('access-code').value = '';
      $('access-code').placeholder = j.settings?.hasAccessCode ? 'A code is set · type a new one, or a space to remove it' : 'Set a code to open the board on your iPhone or iPad';
      const cur = $('access-code-current');
      cur.hidden = !j.settings?.accessCode;
      cur.textContent = j.settings?.accessCode ? `CURRENT CODE · ${j.settings.accessCode}` : '';
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
      plan: Object.fromEntries(PLAN_KEYS.map((k) => [k, num(`plan-${k}`)])),
      notify: $('notify-toggle').checked,
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
      load(false); // the server has re-ticked the week's plan; the cached board comes back at once
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

  // ---------- share today as a picture (1.4) ----------

  /** Draws the day's card on the canvas with the Canvas 2D API, in the current colours. */
  function drawShareCard(canvas, b) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const C = { bg: css('--bg'), ink: css('--ink'), text: css('--text'), dim: css('--dim'), track: css('--track'), grid: css('--grid'), c1: css('--c1'), c2: css('--c2'), c3: css('--c3'), c5: css('--c5'), c6: css('--c6'), c7: css('--c7'), c8: css('--c8'), ok: css('--ok') };
    const font = (px, bold = true) => `${bold ? 700 : 400} ${px}px Antonio, "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    const text = (s, x, y, px, color, align = 'left', bold = true) => { ctx.font = font(px, bold); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(s ?? '—').toUpperCase(), x, y); };
    const rr = (x, y, w, h, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
    const now = new Date();
    const t = b.today || {}, s = b.sleep || {}, wk = b.week || {}, a = b.activities || {}, w = b.weight || null, p = b.plan || {};
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // top frame
    rr(40, 40, 1000, 70, 35, C.c1);
    rr(40, 40, 380, 70, 35, C.c1);
    text('AMS GARMIN · BRIDGE', 70, 90, 40, C.ink);
    rr(440, 40, 220, 70, 0, C.c3); rr(670, 40, 120, 70, 0, C.c2); rr(800, 40, 240, 70, 35, C.c2);
    text(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 1010, 90, 30, C.ink, 'right');

    // a panel helper
    const panel = (x, y, w, h, title, color) => {
      rr(x, y, w, 26, 13, color); ctx.fillStyle = color; ctx.fillRect(x + 20, y, w - 20, 26);
      text(title, x + 22, y + 20, 22, C.ink);
      ctx.fillStyle = C.track; ctx.globalAlpha = 0.5; ctx.fillRect(x, y + 34, w, h - 34); ctx.globalAlpha = 1;
    };
    const big = (x, y, value, label, color) => { text(value, x, y, 64, color); text(label, x, y + 28, 20, C.dim); };

    // steps ring
    panel(40, 140, 480, 330, 'STEPS TODAY', C.c2);
    const cx = 170, cy = 330, r = 110;
    const ratio = isNum(t.steps) && isNum(t.stepGoal) && t.stepGoal > 0 ? Math.min(1, t.steps / t.stepGoal) : 0;
    ctx.lineCap = 'round'; ctx.lineWidth = 26;
    ctx.strokeStyle = C.track; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    if (ratio > 0.002) { ctx.strokeStyle = C.c2; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * ratio)); ctx.stroke(); }
    text(fmtInt(t.steps), cx, cy + 18, 54, C.c2, 'center');
    text(isNum(t.stepGoal) ? `${Math.round(ratio * 100)} % OF ${fmtInt(t.stepGoal)}` : 'NO GOAL', cx, cy + 95, 20, C.dim, 'center');
    big(330, 260, fmtKm(t.distanceM), 'DISTANCE', C.c2);
    big(330, 360, fmtInt(t.floorsUp), 'FLOORS UP', C.c2);
    const chip = t.stepsCompare;
    if (chip && isNum(chip.steps)) text(`${chip.delta > 0 ? '▲ +' : chip.delta < 0 ? '▼ −' : '= '}${fmtInt(Math.abs(chip.delta))} VS 4 WEEKS AGO`, 330, 440, 20, chip.delta >= 0 ? C.ok : C.c7);

    // cardio and battery
    panel(560, 140, 480, 330, 'CARDIO · TODAY', C.c7);
    big(590, 260, isNum(t.restingHr) ? `${t.restingHr}` : '—', 'RESTING PULSE · BPM', C.c7);
    big(820, 260, isNum(t.bodyBattery?.latest) ? `${t.bodyBattery.latest}` : '—', 'BODY BATTERY', C.c5);
    big(590, 360, isNum(t.stressAvg) ? `${t.stressAvg}` : '—', 'STRESS · AVERAGE', C.c1);
    big(820, 360, isNum(b.month?.restingHrAvg) ? `${b.month.restingHrAvg}` : '—', 'MONTH AVERAGE PULSE', C.c7);
    text(b.stress?.today?.qualifier ? `GARMIN SAYS ${b.stress.today.qualifier}` : '', 590, 440, 20, C.dim);

    // sleep, intensity, workouts, weight
    panel(40, 500, 480, 230, 'SLEEP · LAST NIGHT', C.c3);
    if (s.recorded) {
      big(70, 610, fmtHours(s.seconds), `ASLEEP${s.qualifier ? ' · ' + s.qualifier : ''}`, C.c3);
      text(`BED ${s.start ? fmtClock(new Date(s.start), undefined, false) : '—'} · UP ${s.end ? fmtClock(new Date(s.end), undefined, false) : '—'}${isNum(s.score) ? ` · SCORE ${s.score}` : ''}`, 70, 690, 22, C.text);
    } else {
      text('NO SLEEP RECORDED', 70, 610, 40, C.c7);
      text('WEAR THE WATCH AT NIGHT', 70, 660, 22, C.dim);
    }
    panel(560, 500, 480, 230, 'INTENSITY · THIS WEEK', C.c1);
    big(590, 610, fmtInt(wk.intensityMinutes), isNum(wk.goal) ? `MINUTES OF ${fmtInt(wk.goal)}` : 'MINUTES', C.c1);
    const wr = isNum(wk.goal) && wk.goal > 0 ? Math.min(1, (wk.intensityMinutes || 0) / wk.goal) : 0;
    rr(590, 660, 420, 22, 11, C.track); if (wr > 0) rr(590, 660, 420 * wr, 22, 11, C.c1);
    text(isNum(wk.goal) ? `${Math.round(wr * 100)} % OF THE WEEKLY GOAL` : '', 590, 712, 20, C.dim);

    panel(40, 760, 480, 230, `WORKOUTS · ${monthWord(b.date.slice(0, 7))}`, C.c6);
    big(70, 870, `${a.count ?? 0}`, `WORKOUTS · ${fmtDur(a.seconds)}`, C.c6);
    text(`${fmtKm(a.distanceM)} · ${fmtInt(a.elevationGain)} M CLIMBED${p.target ? ` · WEEK PLAN ${p.done}/${p.target}` : ''}`, 70, 950, 22, C.text);
    panel(560, 760, 480, 230, 'MASS', C.c5);
    big(590, 870, w ? fmtKg(w.kg) : '—', w?.date ? `WEIGHED ${fmtDay(w.date)}` : 'NO WEIGH-IN IN 90 DAYS', C.c5);
    if (w && isNum(w.deltaKg)) text(`${w.deltaKg > 0 ? '▲ +' : w.deltaKg < 0 ? '▼ −' : '= '}${Math.abs(w.deltaKg).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KG SINCE THE WEIGH-IN BEFORE`, 590, 950, 22, C.text);

    // the month as bars
    panel(40, 1020, 1000, 220, `STEPS · ${monthWord(b.date.slice(0, 7))} SO FAR`, C.c2);
    const days = b.month?.days || [];
    const top = Math.max(1, ...days.map((d) => Math.max(d.steps || 0, d.stepGoal || 0)));
    const bx = 70, by = 1215, bw = 960 / Math.max(1, days.length), bh = 130;
    days.forEach((d, i) => {
      const h = ((d.steps || 0) / top) * bh;
      ctx.fillStyle = d.date === b.date ? C.c6 : C.c2; ctx.globalAlpha = d.stepGoal && d.steps >= d.stepGoal ? 1 : 0.55;
      if (h > 0) ctx.fillRect(bx + i * bw + bw * 0.15, by - h, bw * 0.7, h);
      ctx.globalAlpha = 1;
      if (d.stepGoal) { ctx.fillStyle = C.c8; ctx.fillRect(bx + i * bw + bw * 0.1, by - (d.stepGoal / top) * bh - 1, bw * 0.8, 2); }
    });
    const logLine = b.log?.[b.date];
    text(logLine ? `LOG · ${logLine}` : `${fmtInt(b.month?.steps)} STEPS · GOAL MET ${b.month?.stepGoalDays ?? 0} DAYS`, 70, 1236, 20, C.dim);

    // footer bar
    rr(40, 1270, 1000, 40, 20, C.c2);
    text(`BOARD ${b.version || ''} · STARDATE ${stardate(now)} · AMS GARMIN BRIDGE BOARD`, 540, 1298, 20, C.ink, 'center');
  }

  const shareFileName = () => `ams-garmin-board-${board?.date || todayIso()}.png`;
  const canShareFiles = () => { try { return !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }); } catch { return false; } };
  async function showShare() {
    if (!board) return;
    openSheet('share-sheet');
    $('share-send').hidden = !canShareFiles();
    try { await document.fonts?.load?.(`700 40px Antonio`); } catch { /* the fallback font will do */ }
    drawShareCard($('share-canvas'), board);
  }
  function canvasBlob() { return new Promise((resolve) => $('share-canvas').toBlob(resolve, 'image/png')); }
  async function saveShare() {
    const blob = await canvasBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = shareFileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('share-save').textContent = 'SAVED';
    setTimeout(() => { $('share-save').textContent = 'SAVE PNG'; }, 1500);
  }
  async function sendShare() {
    const blob = await canvasBlob();
    if (!blob) return;
    const file = new File([blob], shareFileName(), { type: 'image/png' });
    try { await navigator.share({ files: [file], title: 'AMS Garmin Board' }); } catch { /* the user closed the share sheet */ }
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
      case 's': case 'S': showShare(); break;
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
  $('share-button').addEventListener('click', showShare);
  $('share-save').addEventListener('click', saveShare);
  $('share-send').addEventListener('click', sendShare);
  $('share-close').addEventListener('click', closeSheets);
  $('plan-edit-button').addEventListener('click', showSettings);
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
  const openWorkout = (id) => {
    showActivity(id);
    $(`wk-act-${id}`)?.classList.add('selected');
    $('activity-detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('workouts-list').addEventListener('click', (e) => {
    const row = e.target.closest('.act[data-id]');
    if (row) openWorkout(row.dataset.id);
  });
  $('bb-curve-chart').addEventListener('click', (e) => {
    const g = e.target.closest('.bb-wk[data-id]');
    if (g) openWorkout(g.dataset.id);
  });
  $('bb-curve-chart').addEventListener('keydown', (e) => {
    const g = e.target.closest('.bb-wk[data-id]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openWorkout(g.dataset.id); }
  });
  $('workouts-list').addEventListener('keydown', (e) => {
    const row = e.target.closest('.act[data-id]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openWorkout(row.dataset.id); }
  });
  for (const r of WORKOUT_RANGES) {
    $(`workouts-tab-${r}`).addEventListener('click', () => {
      workoutsRange = r;
      try { localStorage.setItem(WORKOUTS_KEY, r); } catch { /* ignore */ }
      renderWorkouts(board);
    });
  }
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
  // ---------- 1.6.0 Peek: hover (Mac) or press and hold (iPhone) a number → its last days and when it was updated ----------
  const fmtHm = (min) => (isNum(min) ? `${Math.floor(min / 60)} h ${pad2(Math.round(min % 60))}` : '—');
  const isoShift = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
  const bpm = (v) => `${fmtInt(v)} bpm`;
  const kcal = (v) => `${fmtInt(v)} kcal`;
  const PEEK = {
    steps: { title: 'Steps', fmt: fmtInt },
    distance: { title: 'Distance', fmt: fmtKm },
    'resting-hr': { title: 'Resting pulse', fmt: bpm },
    'hr-min': { title: 'Lowest pulse', fmt: bpm },
    'hr-max': { title: 'Highest pulse', fmt: bpm },
    stress: { title: 'Stress · average', fmt: fmtInt },
    'stress-max': { title: 'Stress · highest', fmt: fmtInt },
    respiration: { title: 'Breaths a minute', fmt: fmt1 },
    'body-battery': { title: "Body Battery · day's high", fmt: fmtInt },
    calories: { title: 'Calories · total', fmt: kcal },
    'calories-active': { title: 'Calories · active', fmt: kcal },
    floors: { title: 'Floors up', fmt: fmtInt },
    intensity: { title: 'Intensity minutes · a day', fmt: (v) => `${fmtInt(v)} min` },
    sleep: { title: 'Sleep', fmt: fmtHm },
    weight: { title: 'Weight', fmt: fmtKg },
    hydration: { title: 'Water', fmt: (v) => `${fmtInt(v)} ml` },
  };
  const peekCard = $('peek-card');
  let peekTimer = null;
  let peekAnchor = null;
  let peekTouch = false;
  const peekTarget = (e) => (e.target && e.target.closest ? e.target.closest('[data-peek]') : null);

  function placePeek(el) {
    const r = el.getBoundingClientRect();
    peekCard.style.left = '0px';
    peekCard.style.top = '0px';
    const w = peekCard.offsetWidth;
    const h = peekCard.offsetHeight;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    top = Math.min(top, Math.max(8, window.innerHeight - h - 8)); // never off the bottom of the window
    peekCard.style.left = `${Math.round(left)}px`;
    peekCard.style.top = `${Math.round(top)}px`;
  }

  function showPeek(el) {
    const key = el.dataset.peek;
    const def = PEEK[key];
    const list = board && board.history ? board.history[key] : null;
    if (!def || !Array.isArray(list)) return;
    peekAnchor = el;
    const panel = el.closest('.panel');
    const pc = panel ? getComputedStyle(panel).getPropertyValue('--pc').trim() : '';
    if (pc) peekCard.style.setProperty('--pc', pc); else peekCard.style.removeProperty('--pc');
    const today = todayIso();
    const latest = list.length ? list[list.length - 1] : null;
    setText('peek-title', def.title);
    setText('peek-value', latest ? `${def.fmt(latest.value)}${latest.date === today ? '' : ' · ' + fmtDay(latest.date)}` : '—');
    const last = list.slice(-7).reverse();
    const max = Math.max(1, ...last.map((p) => p.value));
    $('peek-rows').innerHTML = last.length ? last.map((p) => {
      const d = new Date(p.date + 'T12:00:00');
      const word = p.date === today ? 'Today' : `${DAY_NAMES[d.getDay()]} ${fmtDay(p.date)}`;
      return `<div class="peek-row${p.date === today ? ' today' : ''}"><span class="d">${escapeHtml(word)}</span><span class="b"><i style="width:${Math.max(0, Math.round(100 * p.value / max))}%"></i></span><span class="v">${escapeHtml(def.fmt(p.value))}</span></div>`;
    }).join('') : '<div class="peek-empty">No values yet</div>';
    const win = list.filter((p) => p.date >= isoShift(today, -29));
    const avg = win.length ? win.reduce((a, p) => a + p.value, 0) / win.length : null;
    const hi = list.length ? list.reduce((a, p) => (p.value > a.value ? p : a)) : null;
    const lo = list.length ? list.reduce((a, p) => (p.value < a.value ? p : a)) : null;
    setText('peek-avg', list.length
      ? `30-day average ${def.fmt(avg)}\n90-day high ${def.fmt(hi.value)} · ${fmtDay(hi.date)} · low ${def.fmt(lo.value)} · ${fmtDay(lo.date)}`
      : 'Nothing recorded in the last 90 days');
    const u = board.updated || {};
    setText('peek-updated', `Watch synced ${u.watchSyncedAt ? fmtStamp(u.watchSyncedAt) : '—'} · board fetched ${fmtStamp(u.fetchedAt || board.generatedAt)}`);
    peekCard.hidden = false;
    peekCard.setAttribute('aria-hidden', 'false');
    placePeek(el);
  }

  function hidePeek() {
    clearTimeout(peekTimer);
    peekTimer = null;
    peekAnchor = null;
    if (peekCard.hidden) return;
    peekCard.hidden = true;
    peekCard.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('mouseover', (e) => {
    if (peekTouch) return;
    const el = peekTarget(e);
    if (!el || (el === peekAnchor && !peekCard.hidden)) return;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => showPeek(el), 250);
  });
  document.addEventListener('mouseout', (e) => {
    if (peekTouch) return;
    const el = peekTarget(e);
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    hidePeek();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const el = peekTarget(e);
    hidePeek();
    if (!el) return;
    peekTouch = true;
    peekTimer = setTimeout(() => showPeek(el), 450); // press and hold
  });
  document.addEventListener('pointerup', () => { clearTimeout(peekTimer); peekTimer = null; });
  document.addEventListener('pointercancel', hidePeek);
  document.addEventListener('contextmenu', (e) => { if (peekTouch && peekTarget(e)) e.preventDefault(); });
  document.addEventListener('scroll', hidePeek, { passive: true, capture: true });
  document.addEventListener('click', (e) => { if (!peekCard.hidden && !peekTarget(e)) hidePeek(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePeek(); });

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
