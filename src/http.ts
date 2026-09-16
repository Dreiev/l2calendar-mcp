import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from './server.js';

const DEFAULT_PORT = 8787;
const MCP_PATH = '/mcp';

type Transport = StreamableHTTPServerTransport;

const transports = new Map<string, Transport>();

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', name: SERVER_NAME, version: SERVER_VERSION });
    return;
  }

  if (url.pathname !== MCP_PATH) {
    sendJson(res, 404, { error: 'Not found. The MCP endpoint is mounted at /mcp.' });
    return;
  }

  const sessionId = req.headers['mcp-session-id'];
  const session = typeof sessionId === 'string' ? transports.get(sessionId) : undefined;

  if (session) {
    const body = req.method === 'POST' ? await readJsonBody(req) : undefined;
    await session.handleRequest(req, res, body);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 400, { error: 'Bad Request: no valid session and the request is not an initialize POST.' });
    return;
  }

  const body = await readJsonBody(req);
  if (!isInitializeRequest(body)) {
    sendJson(res, 400, { error: 'Bad Request: expected an initialize request to open a session.' });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId: string) => {
      transports.set(newSessionId, transport);
    },
  });

  transport.onclose = () => {
    const closedId = transport.sessionId;
    if (closedId) transports.delete(closedId);
  };

  const server = buildServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

export interface HttpServerOptions {
  port?: number;
  host?: string;
}

export function startHttpServer(options: HttpServerOptions = {}): ReturnType<typeof createServer> {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? '127.0.0.1';

  const httpServer = createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      console.error('[l2calendar-mcp] unhandled request error:', error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' });
      } else {
        res.end();
      }
    });
  });

  httpServer.listen(port, host, () => {
    console.error(`[l2calendar-mcp] listening on http://${host}:${port}${MCP_PATH}`);
  });

  return httpServer;
}
