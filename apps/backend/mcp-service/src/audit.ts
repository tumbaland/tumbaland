import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuditEvent, logger } from '@tumbaland/backend-core';
import type { Caller } from './tools/module';

/**
 * What each tool call cost, recorded where the cost is actually visible.
 *
 * Every service already records what an assistant read from it, but those rows
 * are about the data: "read the dashboard", once, whatever came back. The
 * expensive part is on this side of the hop — the text handed to the model —
 * and nothing downstream can see it. `/dashboard` answering with a hundred and
 * twenty-nine daily snapshots and answering with four numbers are the same row
 * in finance-service's trail and a nine-thousand-token difference here.
 *
 * It matters more than the size of one answer suggests. A tool result is not a
 * page someone closes: it stays in the conversation and is sent again with
 * every message that follows, so one large answer is paid for on every turn
 * after it. A trail that records the size makes that arithmetic something a
 * person can look at rather than infer from a bill.
 */

const SERVICE = 'mcp-service';

/** Four characters to a token — see `ToolCall.tokens` for why an estimate is enough. */
const CHARS_PER_TOKEN = 4;

/** What a tool handler answers with, as much of it as measuring needs. */
interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/** Everything the model was handed, as one length. */
const textLength = (result: ToolResult | undefined): number =>
  (result?.content ?? []).reduce((total, part) => total + (part.text?.length ?? 0), 0);

/**
 * Write one row, and never let writing it fail the call it describes.
 *
 * Fire-and-forget for the same reason the read trail is: instrumentation that
 * can break the thing it instruments is worse than no instrumentation. The
 * process log carries the same line, so a Mongo outage costs the history rather
 * than the visibility.
 */
function record(caller: Caller, name: string, ms: number, result: ToolResult | undefined): void {
  // The whole body, not just the write. A tool call that succeeded and then
  // failed because measuring it went wrong would be the worst possible bug to
  // ship from a file whose entire job is to watch — and the throw would surface
  // to the model as a tool failure, so it would retry the expensive call.
  try {
    const chars = textLength(result);
    const tokens = Math.round(chars / CHARS_PER_TOKEN);
    const failed = result?.isError === true || result === undefined;

    logger.info('MCP tool call', { tool: name, ms, chars, tokens, failed });

    const actor = caller.actor;
    if (!actor) return;

    void AuditEvent.create({
      at: new Date(),
      service: SERVICE,
      action: 'call',
      // The tool name lives in `tool.name`, so the resource stays the crude noun
      // every other row uses. A trail filtered to "tool" is the list of what the
      // assistant asked for, whatever it asked for.
      resource: 'tool',
      actorKind: actor.kind,
      userId: actor.userId,
      actorLabel: actor.label,
      actorCredentialId: actor.credentialId,
      tenant: caller.tenants.default,
      tool: { name, ms, chars, tokens, ...(failed ? { failed: true } : {}) }
    }).catch((error) => {
      logger.warn('Could not record a tool call', { error: (error as Error)?.message });
    });
  } catch (error) {
    logger.warn('Could not record a tool call', { error: (error as Error)?.message });
  }
}

/**
 * The server the tool modules register against, with every handler timed.
 *
 * A proxy rather than a helper each module remembers to wrap its handlers in:
 * the one that gets forgotten is the one nobody measures, and a tool added a
 * year from now should be measured without its author having to know this file
 * exists. The modules go on calling `registerTool` exactly as before.
 */
export function auditTools(server: McpServer, caller: Caller): McpServer {
  return new Proxy(server, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property !== 'registerTool' || typeof value !== 'function') return value;

      return (name: string, config: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) =>
        (value as (...args: unknown[]) => unknown).call(
          target,
          name,
          config,
          async (...args: unknown[]) => {
            const started = Date.now();
            try {
              const result = await handler(...args);
              record(caller, name, Date.now() - started, result);
              return result;
            } catch (error) {
              // A throw never reaches the model as content, so there is nothing
              // to size — but the time it took and the fact it failed are the
              // two things worth knowing about a tool that keeps blowing up.
              record(caller, name, Date.now() - started, undefined);
              throw error;
            }
          }
        );
    }
  });
}
