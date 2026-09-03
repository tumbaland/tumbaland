import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger, verifyApiKey } from '@tumbaland/backend-core';
import { registerTools } from './tools';

const SERVER_NAME = 'tumbaland';
const SERVER_VERSION = '1.0.0';

/**
 * Server-level guidance, returned on `initialize` and injected by clients that
 * support it.
 *
 * This is the place for things true of the whole server rather than of one
 * tool. Per-tool wording belongs in the tool descriptions — repeating it here
 * only makes the two drift apart.
 */
const SERVER_INSTRUCTIONS = [
  'Tumbaland is a private journal of what two people do together.',
  '',
  'Dates are always YYYY-MM-DD. When the user says "Saturday" or "yesterday", work out the',
  'actual date from today first, and say which date you used so a mistake is visible.',
  '',
  'Activity types are per-account and fixed: call list_activity_types before the first write',
  'in a conversation, and use one of the names it returns. Never invent a type. If nothing fits,',
  'ask the user rather than forcing the entry into an unrelated type.',
  '',
  'Prefer log_day for a whole evening or day, and log_activity for a single thing. Both add to',
  'what is already recorded, so ask about the parts you were told about and nothing more.',
  '',
  'This is personal data. Write what the user actually said — do not embellish a description,',
  'infer hours that were not mentioned, or fill in a place that was not named.'
].join('\n');

/** Where a client is told to go when it presents nothing usable. */
const canonicalUrl = (): string =>
  (process.env.MCP_PUBLIC_URL || 'https://mcp.tumbaland.eu').replace(/\/$/, '');

/**
 * Refuse a request the way the MCP spec expects.
 *
 * A bare 401 leaves a spec-compliant client with nowhere to go. `WWW-Authenticate`
 * pointing at protected-resource metadata is what lets a client discover how to
 * authenticate, and it is the hook OAuth support will hang off later — for now
 * the metadata simply says a bearer token is what this server wants.
 */
function unauthorized(res: Response, detail: string): void {
  res
    .status(401)
    .set(
      'WWW-Authenticate',
      `Bearer resource_metadata="${canonicalUrl()}/.well-known/oauth-protected-resource"`
    )
    .json({
      jsonrpc: '2.0',
      error: { code: -32001, message: detail },
      id: null
    });
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  /**
   * The root is not part of the protocol — MCP lives entirely at /mcp — but it
   * is the first thing anyone types when checking whether the service is up,
   * and Express's default HTML "Error" page answers that question badly.
   */
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: 'Tumbaland MCP server. Connect an assistant to log and read your journal.',
      endpoint: `${canonicalUrl()}/mcp`,
      transport: 'streamable-http',
      authentication: 'Bearer token — a Tumbaland API key from account settings',
      documentation: 'https://modelcontextprotocol.io'
    });
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'mcp-service' });
  });

  /**
   * RFC 9728 protected resource metadata.
   *
   * Served now, before there is an authorization server to point at, because it
   * is how a client discovers what this endpoint wants. The `scopes_supported`
   * list is the same vocabulary the API keys carry, so a client that later goes
   * through OAuth asks for exactly what a key would have granted.
   */
  app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    res.json({
      resource: canonicalUrl(),
      scopes_supported: ['relationship:read', 'relationship:write'],
      bearer_methods_supported: ['header']
    });
  });

  /**
   * The MCP endpoint.
   *
   * A fresh server and transport per request, in stateless mode: MCP sessions
   * would have to be pinned to one process, and this runs behind the same
   * reverse proxy as everything else with no such guarantee. Each call carries
   * its own key anyway, so there is no per-connection state worth keeping.
   */
  app.post('/mcp', async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) {
      unauthorized(res, 'Authorization required: send a Tumbaland API key as a bearer token.');
      return;
    }

    const verification = await verifyApiKey(token);
    if (!verification.ok) {
      logger.warn('MCP request rejected', { rejection: verification.rejection });
      unauthorized(res, 'Invalid or expired API key.');
      return;
    }

    const server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { instructions: SERVER_INSTRUCTIONS }
    );
    registerTools(server, token);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    // Tie both to the request: an aborted connection must not leave a server
    // and a transport behind, and this endpoint is hit once per tool call.
    res.on('close', () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP request failed', { error: (error as Error)?.message });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  // Anything else: JSON, not Express's HTML error page. A client that wandered
  // off the path is far more likely to be parsing JSON than rendering markup.
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'not_found',
      message: `No route for ${req.method} ${req.path}. The MCP endpoint is POST /mcp.`
    });
  });

  return app;
}

export default createApp();
