import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  logger,
  verifyApiKey,
  verifyAccessToken,
  looksLikeApiKey,
  PERSONAL_TENANT
} from '@tumbaland/backend-core';
import type { ApiKeyScope, ApiKeyTenant } from '@tumbaland/backend-core';
import { SERVED_SCOPES, registerTools } from './tools';

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
  'To change or remove something already logged, read the day with get_day, then use',
  'edit_activity or delete_activity with the id it gives you. Never rewrite a day to correct',
  'one entry — log_day with replace would discard everything else recorded that day.',
  '',
  'delete_activity cannot be undone. Only ever call it when the user asked for something to be',
  'removed; when they asked for a correction, edit_activity is the tool.',
  '',
  'Something coming up (a concert on Friday, a trip) is a plan, not an entry: plan_event puts it',
  'in the calendar and reminds everyone in the journal’s chat before it starts. Log an entry only',
  'for what already happened.',
  '',
'Money lives in a separate set of tools. Nothing there can create a transaction — those come',
  'from importing a bank statement — so if the user wants a one-off expense recorded, say that it',
  'has to be done in the app rather than inventing a trade to stand in for it.',
  '',
'Photos are searched one album at a time, and nothing in the library knows what a picture',
  'shows. There is no way to find "the ones with the dog". Say so rather than searching album',
  'after album and reporting nothing found.',
  '',
  'A picture you have on disk, such as a chart you made, goes into an album in three steps:',
  'create_album if it needs a new one, start_photo_upload for a link, PUT the file there,',
  'then finish_photo_upload. The bytes go to the link, never into a tool call.',
  '',
  'Collages: view_photos is how you see what photos show. You may change only collages an',
  'assistant made; for one a person made, make a new one like it. What you make is theirs to',
  'check and adjust in the app, so say what you chose rather than asking them to approve each step.',
  'Lay collages out as the make_collage prompt describes: the canvas filled, the title kept clear,',
  'a funny caption on every photo.',
  '',
  'recategorise_transactions moves many rows at once. Say how many are involved and get agreement',
  'before calling it.',
  '',
  'This is personal data. Write what the user actually said — do not embellish a description,',
  'infer hours that were not mentioned, or fill in a place that was not named.'
].join('\n');

/** Where a client is told to go when it presents nothing usable. */
const canonicalUrl = (): string =>
  (process.env.MCP_PUBLIC_URL || 'https://mcp.tumbaland.eu').replace(/\/$/, '');

/** The authorization server that issues tokens for this resource. */
const authorizationServer = (): string =>
  (process.env.AUTH_SERVICE_PUBLIC_URL || 'https://auth-api.tumbaland.eu').replace(/\/$/, '');

/**
 * Answer the listings this server has nothing to offer for.
 *
 * MCP has three kinds of thing — tools, resources and prompts — and this server
 * only has tools. Registering none of the others meant `resources/list` and
 * `prompts/list` returned "Method not found", and a client cannot tell a server
 * that has no resources from one that is broken.
 *
 * The Claude apps ask: their connector calls `list_mcp_resources` during
 * discovery, took the error as a failure, and reported "No matching tools
 * found" for a server whose tools were listed correctly the whole time. An
 * empty list is the honest answer and costs nothing.
 *
 * Prompts only when there are none. A module that registered one (the collage
 * tools do) has already set up the real listing, and answering empty over it
 * would hide the prompt from every client.
 */
function answerEmptyListings(server: McpServer): void {
  // The SDK throws on a second handler for a method, which is the public way to ask.
  let hasPrompts = false;
  try {
    server.server.assertCanSetRequestHandler(ListPromptsRequestSchema.shape.method.value);
  } catch {
    hasPrompts = true;
  }
  server.server.registerCapabilities({ resources: {}, ...(hasPrompts ? {} : { prompts: {} }) });
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: []
  }));
  if (!hasPrompts) server.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
}

interface Authenticated {
  ok: boolean;
  rejection?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  keyId?: string;
  /** what the credential is called: the key's name, or the app's */
  label?: string;
  /** an API key was presented rather than a token granted through consent */
  isApiKey?: boolean;
  scopes?: ApiKeyScope[];
  tenants?: ApiKeyTenant;
  /** what each granted tenant is called; empty for an API key, which has no consent screen */
  tenantNames?: Record<string, string>;
}

/**
 * Accept either credential this server understands.
 *
 * An API key is a long-lived secret a person pasted into a config; an OAuth
 * access token is short-lived and was granted through a consent screen. They
 * arrive the same way and mean the same thing downstream — a user, a set of
 * scopes, and a tenant — so the difference is settled here and nowhere else.
 *
 * The prefix decides which path to take, so an expired access token is never
 * reported as a bad API key.
 */
async function authenticate(token: string): Promise<Authenticated> {
  if (looksLikeApiKey(token)) {
    return { ...(await verifyApiKey(token)), isApiKey: true };
  }

  const result = verifyAccessToken(token, canonicalUrl());
  return {
    ok: result.ok,
    rejection: result.rejection,
    userId: result.userId,
    userEmail: result.email,
    userName: result.name,
    // The client id, not the token's own: an access token is refreshed hourly
    // and a trail keyed on it would show a different actor every hour.
    keyId: result.clientId,
    label: result.clientName,
    isApiKey: false,
    scopes: result.scopes,
    tenants: result.tenants,
    tenantNames: result.tenantNames
  };
}

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
   * is how a client discovers what this endpoint wants. `scopes_supported` is
   * derived from the registered tool modules, so what a user is asked to
   * approve is exactly what this server can act on — never a permission with
   * nothing behind it.
   */
  app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    res.json({
      resource: canonicalUrl(),
      // Where a client goes to obtain a token. Without this a spec-compliant
      // client can discover that it needs to authenticate but not how.
      authorization_servers: [authorizationServer()],
      scopes_supported: SERVED_SCOPES,
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

    const verification = await authenticate(token);
    if (!verification.ok) {
      logger.warn('MCP request rejected', { rejection: verification.rejection });
      unauthorized(res, 'Invalid or expired credentials.');
      return;
    }

    const server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { instructions: SERVER_INSTRUCTIONS }
    );
    // The surface is built from the key's own scopes, so a read-only key is
    // never shown a tool that would 403 on it.
    const modules = registerTools(
      server,
      {
        token,
        tenants: verification.tenants ?? { allowed: [PERSONAL_TENANT], default: PERSONAL_TENANT },
        tenantNames: verification.tenantNames ?? {},
        // Named the way the account page names it, so a row in the trail reads
        // "Claude called get_net_worth" rather than naming a credential id.
        actor: verification.userId
          ? {
              kind: verification.isApiKey ? 'key' : 'assistant',
              userId: verification.userId,
              label: verification.label || verification.userEmail || verification.userId,
              credentialId: verification.keyId
            }
          : undefined
      },
      verification.scopes ?? []
    );
    if (modules === 0) {
      logger.warn('API key has no scopes matching any tool module', { keyId: verification.keyId });
    }

    answerEmptyListings(server);

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
