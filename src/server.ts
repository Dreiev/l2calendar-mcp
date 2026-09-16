import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  collectLabels,
  fetchChronicles,
  fetchServers,
  findServerByName,
  getBaseUrl,
  searchServers,
  selectServers,
  type PublicServer,
} from './api.js';

export const SERVER_NAME = 'l2calendar-mcp';
export const SERVER_VERSION = '1.0.0';

function toText(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function summarizeServer(server: PublicServer) {
  return {
    name: server.name,
    website_url: server.website_url,
    rate: server.rate,
    opening_date: server.opening_date,
    opening_time: server.opening_time,
    opening_datetime_utc: server.opening_datetime_utc,
    chronicle: server.chronicle,
    is_vip: server.is_vip,
    is_new: server.is_new,
    labels: server.labels.map((label) => label.name),
  };
}

export function buildServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    'list_servers',
    {
      title: 'List Lineage 2 private servers',
      description:
        'List Lineage 2 private servers tracked by L2 Calendar, ordered by VIP status and opening date. Optionally filter by chronicle, upcoming openings, newly added entries or rate range.',
      inputSchema: {
        chronicle: z
          .string()
          .optional()
          .describe(
            'Chronicle slug to filter by (e.g. interlude, high-five, classic, essence, god, gracia-final). Use get_chronicles for the full list.',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Maximum number of servers to return (1-50). Defaults to 50, the API page size.'),
        only_upcoming: z
          .boolean()
          .optional()
          .describe('When true, only return servers whose opening date is today or later.'),
        new_only: z
          .boolean()
          .optional()
          .describe('When true, only return servers flagged as newly added entries.'),
        min_rate: z.number().optional().describe('Minimum numeric rate (e.g. 100 for x100+). GVE entries are excluded.'),
        max_rate: z.number().optional().describe('Maximum numeric rate. GVE entries are excluded.'),
      },
    },
    async ({ chronicle, limit, only_upcoming, new_only, min_rate, max_rate }) => {
      const servers = await fetchServers(chronicle);
      const filtered = selectServers(servers, {
        limit,
        onlyUpcoming: only_upcoming,
        newOnly: new_only,
        minRate: min_rate,
        maxRate: max_rate,
      });
      return {
        content: [
          {
            type: 'text',
            text: toText({
              source: `${getBaseUrl()}/api/servers`,
              chronicle: chronicle ?? null,
              returned: filtered.length,
              servers: filtered.map(summarizeServer),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_chronicles',
    {
      title: 'List Lineage 2 chronicles',
      description:
        'List every Lineage 2 chronicle tracked by L2 Calendar (slug, display name and order). Use the slugs as the chronicle filter for list_servers.',
      inputSchema: {},
    },
    async () => {
      const chronicles = await fetchChronicles();
      return {
        content: [
          {
            type: 'text',
            text: toText({
              source: `${getBaseUrl()}/api/chronicles`,
              count: chronicles.length,
              chronicles,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'search_servers',
    {
      title: 'Search Lineage 2 private servers',
      description:
        'Search the current L2 Calendar server page by free text. Matches the server name, website, rate, chronicle, description and labels (case-insensitive).',
      inputSchema: {
        query: z.string().min(1).describe('Text to match, for example "interlude x1000" or a server name.'),
        limit: z.number().int().min(1).max(50).optional().describe('Maximum number of matches to return (1-50).'),
      },
    },
    async ({ query, limit }) => {
      const servers = await fetchServers();
      const matches = searchServers(servers, query).slice(0, limit ?? servers.length);
      return {
        content: [
          {
            type: 'text',
            text: toText({
              source: `${getBaseUrl()}/api/servers`,
              query,
              returned: matches.length,
              servers: matches.map(summarizeServer),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'get_server',
    {
      title: 'Get a Lineage 2 private server',
      description:
        'Return the full public record of a single server by its exact name (case-insensitive), including description and labels.',
      inputSchema: {
        name: z.string().min(1).describe('Exact server name, for example "L2Hispano".'),
        chronicle: z.string().optional().describe('Optional chronicle slug to narrow the lookup.'),
      },
    },
    async ({ name, chronicle }) => {
      const servers = await fetchServers(chronicle);
      const match = findServerByName(servers, name);
      if (!match) {
        return {
          content: [
            {
              type: 'text',
              text: toText({
                found: false,
                name,
                message: 'No server with that exact name is present in the current public page.',
              }),
            },
          ],
        };
      }
      return {
        content: [{ type: 'text', text: toText({ found: true, server: match }) }],
      };
    },
  );

  server.registerTool(
    'list_labels',
    {
      title: 'List server labels',
      description:
        'List the distinct labels (e.g. PTS, Low rate, Craft) currently applied to servers on the public page, with their colors.',
      inputSchema: {},
    },
    async () => {
      const servers = await fetchServers();
      const labels = collectLabels(servers);
      return {
        content: [
          {
            type: 'text',
            text: toText({
              source: `${getBaseUrl()}/api/servers`,
              count: labels.length,
              labels,
            }),
          },
        ],
      };
    },
  );

  return server;
}
