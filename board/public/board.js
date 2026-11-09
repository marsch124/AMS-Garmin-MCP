// AMS Garmin Board — draws the instruments. Plain browser JavaScript, no libraries.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LOCALE = 'sv-SE';
  const HOME_ZONE = 'Europe/Stockholm';
  const REFRESH_EVERY_MS = 10 * 60 * 1000;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---------- formatting ----------

  const pad2 = (n) => String(n).padStart(2, '0');
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const fmtInt = (n) => (isNum(n) ? Math.round(n).toLocaleString(LOCALE) : '—');
  const fmtKm = (m) => (isNum(m) ? (m / 1000).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km' : '—');
  const fmtKg = (kg) => (isNum(kg) ? kg.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg' : '—');
  const fmtDur = (s) => {
    if (!isNum(s)) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h} h ${pad2(m)}` : `${m} min`;
  };
  const fmtHours = (s) => (isNum(s) ? `${Math.floor(s / 3600)} h ${pad2(Math.round((s % 3600) / 60))}` : '—');
  const fmtClock = (date, timeZone, seconds = true) => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hour12: false, ...(timeZone ? { timeZone } : {}),
  }).format(date);
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
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
    // Playful: year.dayOfYear, e.g. 2026.313.
    return `${date.getFullYear()}.${String(dayOfYear(date)).padStart(3, '0')}`;
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

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

  /** A 270° arc gauge: value against a maximum, with an overflow ring once past it. */
  function drawArcGauge(host, { value, max, color, over = css('--c6'), big, small, unit }) {
    const ratio = isNum(value) && isNum(max) && max > 0 ? Math.min(1, value / max) : 0;
    const overRatio = isNum(value) && isNum(max) && max > 0 && value > max ? Math.min(1, (value - max) / max) : 0;
    const start = -135;
    const sweep = 270;
    const cx = 100, cy = 100, r = 78;
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

  /** A vertical thermometer-style bar with a scale, the current value and two markers. */
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
      for (const p of placed) if (Math.abs(ty - p) < 12) ty = p + 12; // keep two close labels apart
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
        ${zoneArcs}
        ${ticks.join('')}
        ${needle}
        <circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>
        <text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="30" font-weight="700" fill="${color}">${isNum(value) ? value : '—'}</text>
        <text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="10" fill="${css('--dim')}">${escapeHtml(label)}${unit ? ' · ' + escapeHtml(unit) : ''}</text>
      </svg>`;
  }

  /** A horizontal segmented bar (0–100) with a marker. */
  function drawHBar(host, { value, max = 100, segments, marker, markerLabel }) {
    const w = 300, h = 26, y = 8, barH = 12;
    const xOf = (v) => (Math.min(max, Math.max(0, v)) / max) * w;
    const segs = segments.map((s) => `<rect x="${f1(xOf(s.from))}" y="${y}" width="${f1(xOf(s.to) - xOf(s.from))}" height="${barH}" fill="${s.color}" opacity=".45"/>`).join('');
    const fill = isNum(value) ? `<rect x="0" y="${y}" width="${f1(xOf(value))}" height="${barH}" rx="6" fill="${css('--c8')}" opacity=".9"/>` : '';
    const mark = isNum(marker)
      ? `<line x1="${f1(xOf(marker))}" y1="2" x2="${f1(xOf(marker))}" y2="${y + barH + 4}" stroke="${css('--c7')}" stroke-width="2"/>
         <text x="${f1(Math.min(w - 2, xOf(marker)))}" y="${y + barH + 14}" text-anchor="${xOf(marker) > w - 40 ? 'end' : 'middle'}" font-size="9" fill="${css('--c7')}">${escapeHtml(markerLabel || '')}</text>`
      : '';
    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h + 8}" preserveAspectRatio="none" role="img" aria-label="stress ${isNum(value) ? value : '—'}">
        <rect x="0" y="${y}" width="${w}" height="${barH}" rx="6" fill="${css('--track')}"/>
        ${segs}${fill}${mark}
      </svg>`;
  }

  /** Bars per day with the goal marked on each bar. */
  function drawBars(host, days, { color, todayColor, goalColor, today }) {
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
        ? `<rect x="${f1(x)}" y="${f1(yOf(steps))}" width="${f1(w)}" height="${f1(padT + plotH - yOf(steps))}" rx="2" fill="${fill}" opacity="${met || isToday ? 1 : 0.55}"/>`
        : '';
      const goal = d.stepGoal
        ? `<line x1="${f1(x - 2)}" y1="${f1(yOf(d.stepGoal))}" x2="${f1(x + w + 2)}" y2="${f1(yOf(d.stepGoal))}" stroke="${goalColor}" stroke-width="2"/>`
        : '';
      const label = `<text x="${f1(x + w / 2)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="${isToday ? todayColor : css('--dim')}">${Number(d.date.slice(8))}</text>`;
      return bar + goal + label;
    }).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="steps per day">${gridLines.join('')}${bars}</svg>`;
  }

  /** A line per day for the resting pulse, with the month average dashed. */
  function drawLine(host, days, { color, avg, avgColor, today }) {
    const W = 620, H = 180, padL = 30, padB = 20, padT = 14;
    const plotW = W - padL - 10, plotH = H - padB - padT;
    const pts = days.filter((d) => isNum(d.restingHr));
    if (!pts.length) {
      host.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="16" fill="${css('--dim')}">NO PULSE DATA YET</text></svg>`;
      return;
    }
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
  }

  // ---------- rendering the data ----------

  const TYPE_TAGS = {
    running: ['RUN', '--c2'], treadmill_running: ['RUN', '--c2'], trail_running: ['RUN', '--c2'],
    cycling: ['BIKE', '--c5'], road_biking: ['BIKE', '--c5'], indoor_cycling: ['BIKE', '--c5'], virtual_ride: ['BIKE', '--c5'], mountain_biking: ['BIKE', '--c5'], gravel_cycling: ['BIKE', '--c5'],
    hiking: ['HIKE', '--c6'], walking: ['WALK', '--c6'],
    strength_training: ['STR', '--c3'],
    open_water_swimming: ['SWIM', '--c4'], lap_swimming: ['SWIM', '--c4'], swimming: ['SWIM', '--c4'],
    yoga: ['YOGA', '--c8'], breathwork: ['BREATH', '--c8'], cardio: ['CARDIO', '--c1'], indoor_cardio: ['CARDIO', '--c1'],
    elliptical: ['CARDIO', '--c1'], rowing: ['ROW', '--c4'], indoor_rowing: ['ROW', '--c4'], skiing: ['SKI', '--c5'],
  };
  function typeTag(type) {
    const t = TYPE_TAGS[type];
    if (t) return { text: t[0], color: css(t[1]) };
    return { text: String(type || 'OTHER').replace(/_/g, ' ').slice(0, 6), color: css('--c1') };
  }

  function renderToday(b) {
    const t = b.today || {};
    const stepsColor = css('--c2');
    drawArcGauge($('steps-gauge'), {
      value: t.steps, max: t.stepGoal, color: stepsColor,
      big: fmtInt(t.steps), unit: 'STEPS',
      small: isNum(t.stepGoal) ? `${Math.round(((t.steps || 0) / t.stepGoal) * 100)} % OF GOAL` : 'NO GOAL SET',
    });
    $('steps-value').textContent = fmtInt(t.steps);
    $('steps-goal').textContent = fmtInt(t.stepGoal);
    $('distance-value').textContent = fmtKm(t.distanceM);

    const bb = t.bodyBattery || {};
    drawThermo($('body-battery-bar'), {
      value: bb.latest, lo: 0, hi: 100, step: 20, color: css('--c5'), label: 'BODY BATTERY',
      markers: [{ value: bb.max, label: 'HIGH', color: css('--c6') }, { value: bb.min, label: 'LOW', color: css('--c7') }],
    });
    $('bb-charged').textContent = isNum(bb.charged) ? `+${bb.charged}` : '—';
    $('bb-drained').textContent = isNum(bb.drained) ? `−${bb.drained}` : '—';

    drawDial($('resting-hr'), {
      value: t.restingHr, lo: 40, hi: 100, color: css('--c7'), label: 'RESTING', unit: 'BPM',
      zones: [
        { from: 40, to: 55, color: css('--c5') },
        { from: 55, to: 70, color: css('--c6') },
        { from: 70, to: 100, color: css('--c7') },
      ],
    });
    $('hr-min').textContent = isNum(t.minHr) ? `${t.minHr}` : '—';
    $('hr-max').textContent = isNum(t.maxHr) ? `${t.maxHr}` : '—';
    $('hr-month-avg').textContent = isNum(b.month?.restingHrAvg) ? `${b.month.restingHrAvg}` : '—';

    drawHBar($('stress-bar'), {
      value: t.stressAvg, marker: t.stressMax, markerLabel: isNum(t.stressMax) ? `MAX ${t.stressMax}` : '',
      segments: [
        { from: 0, to: 25, color: css('--c5') },
        { from: 25, to: 50, color: css('--c6') },
        { from: 50, to: 75, color: css('--c1') },
        { from: 75, to: 100, color: css('--c7') },
      ],
    });
    $('stress-avg').textContent = isNum(t.stressAvg) ? `${t.stressAvg}` : 'UNKNOWN';
    $('stress-max').textContent = isNum(t.stressMax) ? `${t.stressMax}` : '—';
    $('respiration-value').textContent = isNum(t.respirationAvg) ? `${t.respirationAvg} / MIN` : '—';

    const week = b.week || {};
    drawArcGauge($('intensity-gauge'), {
      value: week.intensityMinutes, max: week.goal, color: css('--c1'),
      big: fmtInt(week.intensityMinutes), unit: 'MINUTES',
      small: isNum(week.goal) ? `${Math.round(((week.intensityMinutes || 0) / week.goal) * 100)} % OF WEEKLY GOAL` : 'NO GOAL SET',
    });
    $('intensity-week').textContent = fmtInt(week.intensityMinutes);
    $('intensity-goal').textContent = fmtInt(week.goal);
    $('intensity-month').textContent = fmtInt(b.month?.intensityMinutes);

    $('calories-value').textContent = fmtInt(t.caloriesTotal);
    $('calories-active').textContent = fmtInt(t.caloriesActive);
    $('floors-value').textContent = fmtInt(t.floorsUp);
    $('floors-goal').textContent = fmtInt(t.floorsGoal);
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
    const parts = [
      ['DEEP', s.deepSeconds, css('--c4')],
      ['LIGHT', s.lightSeconds, css('--c5')],
      ['REM', s.remSeconds, css('--c3')],
      ['AWAKE', s.awakeSeconds, css('--c7')],
    ];
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
      <div class="big-row">
        <div class="big"><span class="v">${h.lastNight}</span><span class="k">LAST NIGHT · MS</span></div>
      </div>
      <div class="kv-row">
        <div class="kv"><span class="k">7-DAY AVG</span><span class="v">${isNum(h.weeklyAvg) ? h.weeklyAvg : '—'}</span></div>
        <div class="kv"><span class="k">STATUS</span><span class="v">${escapeHtml(h.status || '—').replace(/_/g, ' ')}</span></div>
        <div class="kv"><span class="k">BASELINE</span><span class="v">${isNum(h.baselineLow) && isNum(h.baselineHigh) ? `${h.baselineLow}–${h.baselineHigh}` : '—'}</span></div>
      </div>`;
  }

  function renderWeight(b) {
    const w = b.weight;
    const kg = w?.kg;
    const base = isNum(kg) ? Math.floor((kg - 4) / 2) * 2 : 70;
    drawThermo($('weight-thermo'), {
      value: kg, lo: base, hi: base + 10, step: 2, color: css('--c6'), unit: 'KG', label: 'WEIGHT', decimals: 1,
      markers: [],
    });
    $('weight-date').textContent = w?.date ? fmtDay(w.date) : 'NO WEIGH-IN';
    $('weight-delta').textContent = isNum(w?.deltaKg) ? `${w.deltaKg > 0 ? '+' : w.deltaKg < 0 ? '−' : ''}${Math.abs(w.deltaKg).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg` : '—';
  }

  function renderMonth(b) {
    const m = b.month || { days: [] };
    const days = m.days || [];
    drawBars($('month-steps-chart'), days, { color: css('--c2'), todayColor: css('--c6'), goalColor: css('--c8'), today: b.date });
    $('month-steps-note').textContent = `${fmtInt(m.steps)} STEPS · GOAL MET ${m.stepGoalDays ?? 0}/${Math.max(0, (m.daysWithData ?? 0) - 1)} DAYS`;
    drawLine($('month-hr-chart'), days, { color: css('--c7'), avg: m.restingHrAvg, avgColor: css('--c8'), today: b.date });
    $('month-hr-note').textContent = isNum(m.restingHrMin) ? `${m.restingHrMin}–${m.restingHrMax} BPM` : '';

    const rows = [
      ['STEPS', fmtInt(m.steps)],
      ['AVERAGE / DAY', fmtInt(m.avgSteps)],
      ['STEP GOAL MET', `${m.stepGoalDays ?? 0} DAYS`],
      ['DISTANCE', fmtKm(m.distanceM)],
      ['FLOORS UP', fmtInt(m.floorsUp)],
      ['INTENSITY MIN', fmtInt(m.intensityMinutes)],
      ['RESTING PULSE', isNum(m.restingHrAvg) ? `${m.restingHrAvg} (${m.restingHrMin}–${m.restingHrMax})` : '—'],
      ['WORKOUTS', `${b.activities?.count ?? 0}`],
      ['TRAINING TIME', fmtDur(b.activities?.seconds)],
      ['DAYS WITH DATA', `${m.daysWithData ?? 0}`],
    ];
    $('month-totals').innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${escapeHtml(v)}</span>`).join('');
  }

  function renderActivities(b) {
    const a = b.activities || { list: [] };
    const list = a.list || [];
    $('activities-total').textContent = list.length
      ? `${a.count} WORKOUTS · ${fmtDur(a.seconds)} · ${fmtKm(a.distanceM)} · ${fmtInt(a.calories)} KCAL · ${fmtInt(a.elevationGain)} M CLIMBED`
      : 'NO WORKOUTS YET THIS MONTH';
    $('activities-list').innerHTML = list.length
      ? list.map((x) => {
        const tag = typeTag(x.type);
        return `<div class="act">
          <span class="tag" style="background:${tag.color}">${escapeHtml(tag.text)}</span>
          <span class="when">${fmtWhen(x.start)}</span>
          <span class="name" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</span>
          <span class="num">${fmtDur(x.seconds)}</span>
          <span class="num">${x.distanceM > 0 ? fmtKm(x.distanceM) : '—'}</span>
          <span class="num">${isNum(x.avgHr) ? `${x.avgHr} BPM` : '—'}</span>
          <span class="te">${escapeHtml((x.trainingEffect || '').replace(/_/g, ' '))}${isNum(x.aerobic) ? ` · TE ${x.aerobic.toFixed(1)}` : ''}</span>
        </div>`;
      }).join('')
      : '<div class="act-empty">THE LOG IS EMPTY. GO MOVE.</div>';
  }

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
    $('token-expiry').textContent = fmtStamp(b.link?.tokenExpiresAt);
    $('version-label').textContent = b.version ? `BOARD ${b.version}` : 'BOARD';
  }

  function render(b) {
    renderToday(b);
    renderSleep(b);
    renderHrv(b);
    renderWeight(b);
    renderMonth(b);
    renderActivities(b);
    renderLink(b, null);
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

  $('refresh-button').addEventListener('click', () => load(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load(false);
  });

  tickClocks();
  setInterval(tickClocks, 1000);
  load(false);
})();
