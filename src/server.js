#!/usr/bin/env node
// AMS Garmin — start-up. Claude launches this file; it speaks the MCP protocol on stdin/stdout.
// Never print to stdout here: that channel belongs to the protocol. Notes go to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GarminClient, FileTokenStore, readApiKey, NO_KEY_MESSAGE } from './garmin-client.js';
import { createServer, VERSION } from './tools.js';

async function main() {
  let client;
  try {
    const apiKey = await readApiKey();
    client = new GarminClient({ apiKey, tokenStore: new FileTokenStore() });
  } catch (err) {
    // No key yet: still start, so every tool can explain what to do.
    const message = err?.code === 'NO_KEY' ? NO_KEY_MESSAGE : `Could not read the Garmin key: ${err.message}`;
    process.stderr.write(`[ams-garmin] ${message}\n`);
    client = {
      async get() { throw err; },
      async getBinary() { throw err; },
      async tokenInfo() { return null; },
    };
  }

  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[ams-garmin] version ${VERSION} ready\n`);
}

main().catch((err) => {
  process.stderr.write(`[ams-garmin] failed to start: ${err?.stack || err}\n`);
  process.exit(1);
});
