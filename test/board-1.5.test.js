// AMS Garmin Board 1.5.0 — "Calm & spacious" look. Tests written before the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');
const SCHEMES = ['calm-dusk', 'calm-dark', 'calm-day', 'ice', 'ember', 'forest', 'graphite'];

// Since 1.5.1 this reads the version from package.json instead of pinning 1.5.0.
test('1.5 A: package.json has a version and the changelog has a heading for it', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.match(await read('CHANGELOG.md'), new RegExp('^## ' + pkg.version.replace(/\./g, '\\.'), 'm'));
  assert.match(await read('CHANGELOG.md'), /^## 1\.5\.0/m);
});

test('1.5 B: the footer version shows the package version', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const html = await read('board', 'public', 'index.html');
  const v = pkg.version.replace(/\./g, '\\.');
  assert.match(html, new RegExp('id="footer-version"[^>]*>[^<]*' + v));
});

test('1.5 C: every scheme defines --card, --edge and --shadow', async () => {
  const css = await read('board', 'public', 'board.css');
  const missing = [];
  for (const name of SCHEMES) {
    for (const v of ['card', 'edge', 'shadow']) {
      const re = new RegExp(':root\\[data-scheme="' + name + '"\\]\\s*\\{[^}]*--' + v + ':');
      if (!re.test(css)) missing.push(name + ' --' + v);
    }
  }
  assert.deepEqual(missing, []);
});

test('1.5 D: panels use the card colour, compare chips are transparent, .t-hero exists', async () => {
  const css = await read('board', 'public', 'board.css');
  assert.match(css, /\.panel\s*\{[^}]*var\(--card\)/);
  assert.match(css, /\.chip\.cmp\s*\{[^}]*background: transparent/);
  assert.ok(css.includes('.t-hero'));
});

test('1.5 E: the panel gap grew to 20px 18px', async () => {
  const css = await read('board', 'public', 'board.css');
  assert.match(css, /\.panels\s*\{[^}]*gap: 20px 18px/);
});

const ACRONYMS = new Set(['UTC']); // the one caption that is an acronym
test('1.5 F: captions and settings labels are in normal letters', async () => {
  const html = await read('board', 'public', 'index.html');
  const bad = [];
  for (const m of html.matchAll(/<span class="(k|tk)"[^>]*>([^<]*)<\/span>/g)) {
    const t = m[2];
    if (/[A-Za-z].*[A-Za-z]/.test(t) && !/[a-z]/.test(t) && !ACRONYMS.has(t)) bad.push(t);
  }
  assert.deepEqual(bad, [], 'all-capital captions: ' + JSON.stringify(bad));
  const form = html.match(/id="settings-form"[\s\S]*?<\/form>/);
  assert.ok(form, 'settings-form present');
  const badLabels = [];
  for (const m of form[0].matchAll(/<label(?:\s[^>]*)?>([^<]*)/g)) {
    const t = m[1];
    if (/[A-Za-z].*[A-Za-z]/.test(t) && !/[a-z]/.test(t)) badLabels.push(t.trim());
  }
  assert.deepEqual(badLabels, [], 'all-capital labels: ' + JSON.stringify(badLabels));
});

test('1.5 G: board.js draws the t-hero, t-unit, t-sub, t-tick and t-mark text classes', async () => {
  const js = await read('board', 'public', 'board.js');
  for (const s of ['class="t-hero"', 'class="t-unit"', 'class="t-sub"', 'class="t-tick"', 'class="t-mark"']) assert.ok(js.includes(s), s);
});

test('1.5 H: board.js notes are sentences, not capitals', async () => {
  const js = await read('board', 'public', 'board.js');
  for (const s of ['No plan set · Edit to add one', 'No sleep data', 'Wear the watch tonight', 'No pulse data yet', 'No water logged']) assert.ok(js.includes(s), s);
  for (const s of ['NO PLAN SET', 'NO SLEEP DATA', 'NO PULSE DATA YET', 'NO WATER LOGGED', 'WEAR THE WATCH TONIGHT']) assert.ok(!js.includes(s), 'still has ' + s);
});

test('1.5 I: svg text uses the prose font and .t-hero uses the font variable', async () => {
  const css = await read('board', 'public', 'board.css');
  assert.match(css, /svg text\s*\{[^}]*var\(--prose\)/);
  assert.match(css, /(svg text\.t-hero|svg[^{}]*\.t-hero)[^{]*\{[^}]*var\(--font\)/);
});

test('1.5 J: README and SPEC mention the new release', async () => {
  assert.ok((await read('README.md')).includes('1.5.0'));
  const spec = await read('docs', 'SPEC.md');
  for (const s of ['--card', 't-hero', 'board-1.5.test.js']) assert.ok(spec.includes(s), s);
});
