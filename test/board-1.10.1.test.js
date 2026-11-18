// AMS Garmin Board 1.10.1 — the line under an arc gauge no longer lies across the arc ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFile(join(ROOT, ...p), 'utf8');

test('1.10.1 A: the arc gauge sub line sits below the round arc ends and inside the viewBox', async () => {
  const js = await read('board', 'public', 'board.js');
  const start = js.indexOf('function drawArcGauge');
  assert.ok(start >= 0, 'drawArcGauge is missing');
  const body = js.slice(start, js.indexOf('function drawThermo', start));
  const y = Number(body.match(/<text class="t-sub"[^>]*\sy="(\d+(?:\.\d+)?)"/)?.[1]);
  const h = Number(body.match(/viewBox="0 0 200 (\d+(?:\.\d+)?)"/)?.[1]);
  assert.ok(y > 0 && h > 0, 'could not read y of t-sub or the viewBox height');
  const arcEnd = 100 + 78 * Math.cos(Math.PI / 4) + 9; // lowest point of the round ends (radius 78, stroke 18)
  assert.ok(y - 12 >= arcEnd, `sub line top ${y - 12} must be at or below the arc ends ${arcEnd}`);
  assert.ok(h >= y + 5, `viewBox height ${h} must leave room under the line at y ${y}`);
});

test('1.10.1 B: package.json is x.y.z and not older than 1.10.1', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const [a, b, c] = pkg.version.split('.').map(Number);
  assert.ok(a > 1 || (a === 1 && (b > 10 || (b === 10 && c >= 1))), pkg.version);
});
