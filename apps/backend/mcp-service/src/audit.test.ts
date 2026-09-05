jest.mock('@tumbaland/backend-core', () => ({
  // Same reasoning as app.test.ts: reached by its own path so the package root,
  // and the ESM one of its dependencies ships, is never pulled in.
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
  AuditEvent: { create: jest.fn().mockResolvedValue(undefined) },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuditEvent, logger, PERSONAL_TENANT } from '@tumbaland/backend-core';
import { auditTools } from './audit';
import type { Caller } from './tools/module';

const created = AuditEvent.create as unknown as jest.Mock;
const logged = logger.info as jest.Mock;

const caller = (actor?: Caller['actor']): Caller => ({
  token: 'tmb_live_x',
  tenants: { allowed: [PERSONAL_TENANT], default: PERSONAL_TENANT },
  tenantNames: {},
  actor
});

const ACTOR: Caller['actor'] = {
  kind: 'assistant',
  userId: 'u1',
  label: 'Claude',
  credentialId: 'client-1'
};

/** Register one tool through the proxy and hand back the wrapped handler. */
const wrap = (
  handler: () => unknown,
  who: Caller = caller(ACTOR)
): ((...args: unknown[]) => Promise<unknown>) => {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const registered: Array<(...args: unknown[]) => Promise<unknown>> = [];
  const spy = jest
    .spyOn(server, 'registerTool')
    .mockImplementation(((_name: string, _config: unknown, fn: never) => {
      registered.push(fn as unknown as (...args: unknown[]) => Promise<unknown>);
      return undefined as never;
    }) as never);

  auditTools(server, who).registerTool('get_net_worth', {} as never, handler as never);
  spy.mockRestore();
  return registered[0]!;
};

describe('auditTools', () => {
  it('records the tool, its size and how long it took', async () => {
    const handler = wrap(() => ({ content: [{ type: 'text', text: 'a'.repeat(400) }] }));

    await handler();

    expect(created).toHaveBeenCalledTimes(1);
    const row = created.mock.calls[0][0];
    expect(row).toMatchObject({
      service: 'mcp-service',
      action: 'call',
      resource: 'tool',
      actorKind: 'assistant',
      userId: 'u1',
      actorLabel: 'Claude',
      actorCredentialId: 'client-1',
      tenant: PERSONAL_TENANT
    });
    expect(row.tool).toMatchObject({ name: 'get_net_worth', chars: 400, tokens: 100 });
    expect(row.tool.ms).toBeGreaterThanOrEqual(0);
    expect(row.tool.failed).toBeUndefined();
  });

  it('sums every content part, because a result can carry more than one', async () => {
    const handler = wrap(() => ({
      content: [
        { type: 'text', text: 'ab' },
        { type: 'text', text: 'cd' }
      ]
    }));

    await handler();

    expect(created.mock.calls[0][0].tool.chars).toBe(4);
  });

  it('marks a tool that answered with an error, so its size reads as a message', async () => {
    const handler = wrap(() => ({ isError: true, content: [{ type: 'text', text: 'no' }] }));

    await handler();

    expect(created.mock.calls[0][0].tool.failed).toBe(true);
  });

  it('records a handler that threw, and lets the throw through', async () => {
    const handler = wrap(() => {
      throw new Error('upstream is down');
    });

    await expect(handler()).rejects.toThrow('upstream is down');
    expect(created.mock.calls[0][0].tool).toMatchObject({
      name: 'get_net_worth',
      chars: 0,
      failed: true
    });
  });

  it('returns whatever the tool returned, untouched', async () => {
    const result = { content: [{ type: 'text', text: 'hello' }] };
    const handler = wrap(() => result);

    await expect(handler()).resolves.toBe(result);
  });

  it('logs the call even when there is nobody to attribute it to', async () => {
    const handler = wrap(() => ({ content: [{ type: 'text', text: 'x' }] }), caller(undefined));

    await handler();

    expect(created).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('MCP tool call', expect.objectContaining({ chars: 1 }));
  });

  it('never fails a call because the trail could not be written', async () => {
    created.mockRejectedValueOnce(new Error('mongo is away'));
    const handler = wrap(() => ({ content: [{ type: 'text', text: 'x' }] }));

    await expect(handler()).resolves.toBeDefined();
    // The rejection is handled asynchronously; let the microtask queue drain.
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not record a tool call',
      expect.objectContaining({ error: 'mongo is away' })
    );
  });

  it('never fails a call because measuring it threw outright', async () => {
    // Not a hypothetical: any environment where the audit model is absent —
    // a test mock, a partially built library — used to take the tool down with
    // it, and the model would read that as a failure and retry the call.
    const model = AuditEvent as unknown as { create: unknown };
    const real = model.create;
    model.create = undefined;
    const handler = wrap(() => ({ content: [{ type: 'text', text: 'x' }] }));

    await expect(handler()).resolves.toBeDefined();

    model.create = real;
  });

  it('leaves everything other than registerTool alone', () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });

    expect(auditTools(server, caller(ACTOR)).server).toBe(server.server);
  });
});
