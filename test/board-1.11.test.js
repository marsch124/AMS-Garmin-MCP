// AMS Garmin Board 1.11.0 — progress per machine in the Gym sessions panel. All numbers are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gymView } from '../board/board-data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const T = '2026-11-18';

const entry = (name, topKg, o = {}) => ({ name, muscle: 'Legs', sets: topKg ? `${topKg} kg × 10` : '20 min', setCount: 1, topKg, pain: false, ...o });
const ses = (id, date, entries) => ({ id, date, start: `${date}T07:00:00Z`, end: `${date}T07:50:00Z`, minutes: 50, gym: 'Invented gym', title: 'Invented day', feel: 'good', notes: null, machines: entries.length, sets: 3, liftedKg: 1000, cardioMinutes: 0, bests: [], entries });
const file = (sessions) => ({ app: 'AMS Workout Companion', format: 1, written: `${T}T09:40:00Z`, sessions });
const m = (g, name) => g.machines.find((x) => x.name === name);

test('1.11 A: no file gives machines []', () => {
  for (const f of [null, undefined, {}, { sessions: [] }]) assert.deepEqual(gymView(f, T).machines, []);
});

test('1.11 B: points are oldest first, with first, last and change', () => {
  const g = gymView(file([
    ses('c', '2026-11-16', [entry('Leg press', 30)]),
    ses('b', '2026-11-12', [entry('Leg press', 27.5)]),
    ses('a', '2026-11-09', [entry('Leg press', 25)]),
  ]), T);
  const lp = m(g, 'Leg press');
  assert.deepEqual(lp.points.map((p) => p.date), ['2026-11-09', '2026-11-12', '2026-11-16']);
  assert.deepEqual(lp.points.map((p) => p.topKg), [25, 27.5, 30]);
  assert.equal(lp.muscle, 'Legs');
  assert.equal(lp.sessions, 3);
  assert.equal(lp.firstKg, 25);
  assert.equal(lp.lastKg, 30);
  assert.equal(lp.changeKg, 5);
  assert.equal(typeof lp.points[0].sets, 'string');
});

test('1.11 C: machines are sorted by name; same machine twice in a session keeps the higher weight', () => {
  const g = gymView(file([
    ses('a', T, [entry('Row', 40), entry('Curl', 15), entry('Row', 45)]),
  ]), T);
  assert.deepEqual(g.machines.map((x) => x.name), ['Curl', 'Row']);
  const row = m(g, 'Row');
  assert.equal(row.points.length, 1);
  assert.equal(row.points[0].topKg, 45);
  assert.equal(row.sessions, 1);
});

test('1.11 D: a machine without weights (bike) and a single session give null numbers', () => {
  const g = gymView(file([
    ses('b', T, [entry('Bike', null), entry('Row', 40)]),
    ses('a', '2026-11-10', [entry('Bike', 0), entry('Row', 35)]),
  ]), T);
  const bike = m(g, 'Bike');
  assert.equal(bike.sessions, 2);
  assert.equal(bike.firstKg, null);
  assert.equal(bike.lastKg, null);
  assert.equal(bike.changeKg, null);
  assert.equal(bike.points[1].topKg === null || bike.points[1].topKg === 0, true);
  const one = gymView(file([ses('a', T, [entry('Row', 40)])]), T);
  assert.equal(m(one, 'Row').firstKg, 40);
  assert.equal(m(one, 'Row').lastKg, 40);
  assert.equal(m(one, 'Row').changeKg, null);
});

test('1.11 E: at most the latest 20 points are kept', () => {
  const sessions = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 10, 18) - i * 86400000).toISOString().slice(0, 10);
    sessions.push(ses(`s${i}`, d, [entry('Press', 20 + (29 - i))]));
  }
  const p = m(gymView(file(sessions), T), 'Press');
  assert.equal(p.points.length, 20);
  assert.equal(p.sessions, 20);
  assert.equal(p.points[19].date, T);
  assert.equal(p.points[0].date < p.points[19].date, true);
  assert.equal(p.lastKg, 49);
});

test('1.11 F: index.html has the progress ids', async () => {
  const html = await read('board', 'public', 'index.html');
  for (const id of ['gym-progress', 'gym-progress-title', 'gym-progress-chart', 'gym-progress-note']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
});
