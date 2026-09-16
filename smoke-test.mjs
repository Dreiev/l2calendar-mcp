import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/index.js'],
  env: { ...process.env, L2CALENDAR_API_URL: process.env.L2CALENDAR_API_URL ?? '' },
});

const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);

const tools = await client.listTools();
console.log('TOOLS:', tools.tools.map((t) => t.name).join(', '));

const chronicles = await client.callTool({ name: 'get_chronicles', arguments: {} });
const chroniclesPayload = JSON.parse(chronicles.content[0].text);
console.log('CHRONICLES count:', chroniclesPayload.count);

const list = await client.callTool({
  name: 'list_servers',
  arguments: { chronicle: 'interlude', limit: 3, only_upcoming: false },
});
const listPayload = JSON.parse(list.content[0].text);
console.log('list_servers returned:', listPayload.returned);
console.log('first:', JSON.stringify(listPayload.servers[0]));

const search = await client.callTool({ name: 'search_servers', arguments: { query: 'interlude', limit: 2 } });
const searchPayload = JSON.parse(search.content[0].text);
console.log('search_servers returned:', searchPayload.returned);

const labels = await client.callTool({ name: 'list_labels', arguments: {} });
console.log('labels count:', JSON.parse(labels.content[0].text).count);

const one = await client.callTool({ name: 'get_server', arguments: { name: listPayload.servers[0].name } });
console.log('get_server found:', JSON.parse(one.content[0].text).found);

await client.close();
console.log('SMOKE OK');
