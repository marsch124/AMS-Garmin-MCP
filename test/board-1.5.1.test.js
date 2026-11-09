// AMS Garmin Board 1.5.1 — narrower "In short" text. Tests written before the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');

test('1.5.1 A: board.css limits #explain-summary to max-width: 60ch', async () => {
  const css = await read('board', 'public', 'board.css');
  const m = css.match(/#explain-summary\s*\{([^}]*)\}/);
  assert.ok(m, 'rule for #explain-summary is missing');
  assert.match(m[1], /max-width:\s*60ch/);
});

test('1.5.1 B: the explain sheet still has "In short" before #explain-summary', async () => {
  const html = await read('board', 'public', 'index.html');
  const sheet = html.slice(html.indexOf('id="explain-sheet"'));
  assert.ok(sheet.length > 0 && html.includes('id="explain-sheet"'));
  const head = sheet.indexOf('In short');
  const para = sheet.indexOf('id="explain-summary"');
  assert.ok(head >= 0 && para > head, 'In short heading must come before explain-summary');
});

test('1.5.1 C: version is x.y.z and the first CHANGELOG heading starts with it', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  const first = (await read('CHANGELOG.md')).match(/^## (.*)$/m);
  assert.ok(first, 'no ## heading in CHANGELOG');
  assert.ok(first[1].startsWith(pkg.version), `first heading "${first[1]}" vs ${pkg.version}`);
});
