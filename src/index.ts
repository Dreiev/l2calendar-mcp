#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { startHttpServer } from './http.js';

function parsePort(args: string[]): number | undefined {
  const flagIndex = args.findIndex((arg) => arg === '--port' || arg === '-p');
  if (flagIndex === -1) return undefined;
  const raw = args[flagIndex + 1];
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--http')) {
    startHttpServer({ port: parsePort(args) });
    return;
  }

  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error('[l2calendar-mcp] fatal error:', error);
  process.exit(1);
});
