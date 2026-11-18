// AMS Garmin Board 1.12.0 — ninth look "Health summary" (id health), now the standard look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const OLD = ['calm-dusk', 'calm-dark', 'calm-day', 'ice', 'ember', 'forest', 'graphite', 'rebel'];
const VARS = ['--bg', '--card', '--edge', '--shadow', '--text', '--dim', '--track', '--grid', '--ink', '--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7', '--c8', '--ok', '--font', '--r'];
const blocks = (css, header) => {
  const out = [];
  let i = css.indexOf(header);
  while (i >= 0) { out.push({ at: i, text: css.slice(i, css.indexOf('}', i)) }); i = css.indexOf(header, i + 1); }
  return out;
};

test('1.12 A: version is x.y.z and matches the footer and the CHANGELOG', async () => {
  const { version } = JSON.parse(await read('package.json'));
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const html = await read('board', 'public', 'index.html');
  const v = version.replace(/\./g, '\\.');
  assert.match(html, new RegExp(`id="footer-version">\\s*${v}`));
  const first = (await read('CHANGELOG.md')).split('\n').find((l) => l.startsWith('## '));
  assert.ok(first.startsWith(`## ${version}`), first);
});

test('1.12 B: index.html starts in the health look and the select has 9 options, health first', async () => {
  const html = await read('board', 'public', 'index.html');
  assert.match(html.match(/<html[^>]*>/)[0], /data-scheme="health"/);
  const sel = html.match(/<select[^>]*id="palette-select"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(sel, 'palette-select');
  const opts = sel[1].match(/<option\b[^>]*>/g) || [];
  assert.equal(opts.length, 9);
  assert.match(opts[0], /value="health"/);
  for (const s of OLD) assert.ok(sel[1].includes(`value="${s}"`), s);
});

test('1.12 C: the head script does the one-time look move before the stylesheet', async () => {
  const html = await read('board', 'public', 'index.html');
  const css = html.indexOf('<link rel="stylesheet" href="board.css">');
  assert.ok(css >= 0, 'stylesheet link');
  for (const s of ['ams-garmin-board.lookMove', "'1.12'"]) {
    const i = html.indexOf(s);
    assert.ok(i >= 0, s);
    assert.ok(i < css, s + ' comes before the stylesheet');
  }
});

test('1.12 D: board.js knows the health look, falls back to it and follows day/night', async () => {
  const js = await read('board', 'public', 'board.js');
  const line = js.split('\n').find((l) => /SCHEMES\s*=\s*\[/.test(l));
  assert.ok(line, 'SCHEMES line');
  for (const s of ['health', ...OLD]) assert.ok(line.includes(`'${s}'`), s);
  assert.ok(js.includes('prefers-color-scheme'));
  assert.match(js, /if \(!SCHEMES\.includes\(scheme\)\) scheme = 'health'/);
});

test('1.12 E: board.css defines the health look in day and in night', async () => {
  const css = await read('board', 'public', 'board.css');
  const all = blocks(css, ':root[data-scheme="health"]');
  assert.ok(all.length >= 2, 'day and night blocks');
  const day = all[0].text;
  for (const v of VARS) assert.ok(new RegExp(v.replace(/-/g, '\\-') + '\\s*:').test(day), v);
  assert.ok(day.includes('--bg: #f2f2f7') && day.includes('--card: #ffffff'));
  const dark = css.indexOf('@media (prefers-color-scheme: dark)');
  assert.ok(dark >= 0, 'dark media query');
  const night = all.find((b) => b.at > dark);
  assert.ok(night, 'night block after the media query');
  assert.ok(night.text.includes('--bg: #000000') && night.text.includes('--card: #1c1c1e'));
});

test('1.12 F: the Health summary section is calm: rounded panels, no glow, no capitals, no frame', async () => {
  const css = await read('board', 'public', 'board.css');
  const a = css.indexOf('1.12.0 · Health summary');
  const b = css.indexOf('1.7.0 · Rebel console (bright)');
  assert.ok(a >= 0 && b >= 0 && a < b, 'markers in order');
  // A capital first letter (::first-letter) is allowed: it turns words that arrive in capitals into normal sentences.
  const sec = css.slice(a, b).split('\n').filter((l) => !l.includes('::first-letter')).join('\n');
  for (const bad of ['text-shadow', 'blur(', 'drop-shadow', 'text-transform: uppercase']) assert.ok(!sec.includes(bad), bad);
  assert.match(sec, /\[data-scheme="health"\]\s+\.panel\s*\{[^}]*border-radius:\s*20px/);
  assert.ok(sec.includes('[data-scheme="health"] .frame-left'), 'LCARS frame rule');
});

test('1.12 G: the old looks are untouched', async () => {
  const css = await read('board', 'public', 'board.css');
  assert.ok(blocks(css, ':root {')[0].text.includes('--bg: #3d3a44'));
  assert.ok(blocks(css, ':root[data-scheme="rebel"]')[0].text.includes('--bg: #e6eef5'));
});
