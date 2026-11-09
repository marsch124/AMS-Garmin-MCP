import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/tools.js';
import { fakeClient, TOOL_NAMES } from './helpers.js';

async function connect(client) {
  const server = createServer(client);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return { mcp, server };
}

const settings = { displayName: 'martin', measurementSystem: 'metric', timeZone: 'Europe/Stockholm' };

test('server lists all 22 tools by name', async () => {
  const { mcp } = await connect(fakeClient(async () => settings));
  const { tools } = await mcp.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOL_NAMES].sort());
  for (const t of tools) assert.ok(t.description, t.name);
  assert.equal(mcp.getServerVersion().name, 'ams-garmin');
  await mcp.close();
});

test('garmin_status returns JSON text', async () => {
  const { mcp } = await connect(fakeClient(async () => settings));
  const r = await mcp.callTool({ name: 'garmin_status', arguments: {} });
  assert.ok(!r.isError);
  assert.equal(r.content[0].type, 'text');
  const data = JSON.parse(r.content[0].text);
  assert.equal(data.connected, true);
  await mcp.close();
});

test('bad date comes back as isError with a plain message', async () => {
  const { mcp } = await connect(fakeClient(async () => []));
  const r = await mcp.callTool({ name: 'garmin_stress', arguments: { startDate: 'yesterday', endDate: '2026-11-01' } });
  assert.equal(r.isError, true);
  assert.equal(r.content[0].type, 'text');
  assert.ok(r.content[0].text.length > 0);
  assert.ok(!r.content[0].text.includes('    at '), 'no stack trace');
  await mcp.close();
});

test('client errors become isError results, not protocol errors', async () => {
  const { GarminError } = await import('../src/garmin-client.js');
  const { mcp } = await connect(fakeClient(async () => { throw new GarminError('Garmin has no data for that request.', { code: 'HTTP', status: 404 }); }));
  const r = await mcp.callTool({ name: 'garmin_day', arguments: { date: '2026-11-01' } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /no data/);
  await mcp.close();
});
