import { createAnthropic } from './anthropicClient';
import { MODELS, isModelId, type ModelId, type TokenUsage } from './assistantModels';

/**
 * One reply from Claude, with Tumbaland's tools attached.
 *
 * The tools are the same MCP server people connect to Claude themselves, reached
 * through the API's MCP connector: Anthropic's side calls `mcp.tumbaland.eu`
 * with the short-lived key it is handed, runs the tool loop, and returns the
 * whole conversation in one response. So this makes one request, not a loop of
 * its own, except to continue a turn the server paused.
 *
 * Streamed, not for the text, which is short, but to see which tool is running:
 * a collage is a dozen tool calls and a minute of work, and "Tumbi is making a
 * collage" is much better than "Tumbi is typing" for all of it.
 */

export const MCP_SERVER_NAME = 'tumbaland';

/** A paused turn is resumed this many times at most, then taken as it stands. */
const MAX_CONTINUATIONS = 3;

const MAX_TOKENS = 4096;

export interface ClaudeRequest {
  apiKey: string;
  model: ModelId;
  /** The base prompt, then the bot's own: each one a cache breakpoint. */
  system: string[];
  user: string;
  mcpUrl: string;
  /** The short-lived Tumbaland key for the person asking. */
  mcpToken: string;
  /** Called with the tool's name when Claude starts using one. */
  onTool?: (name: string) => void;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  isError: boolean;
  /** What the tool answered, as text. */
  result: string;
}

export interface ClaudeReply {
  text: string;
  /** Anthropic's safety systems declined, and no fallback answered either. */
  refused: boolean;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  /** The model that actually answered, which differs from the one asked when a fallback ran. */
  servedBy: ModelId;
}

type Block = { type: string } & Record<string, unknown>;

export async function askClaude(request: ClaudeRequest): Promise<ClaudeReply> {
  const client = createAnthropic(request.apiKey);
  const spec = MODELS[request.model];
  const betas = ['mcp-client-2025-11-20', ...(spec.fallbacks ? ['server-side-fallback-2026-07-01'] : [])];

  const messages: Array<{ role: 'user' | 'assistant'; content: string | Block[] }> = [{ role: 'user', content: request.user }];
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const content: Block[] = [];
  let servedBy: ModelId = request.model;
  let stopReason: string | null = null;

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream({
      model: request.model,
      max_tokens: MAX_TOKENS,
      betas,
      // Refused requests are re-run on a substitute model by the server, where the model allows it.
      ...(spec.fallbacks ? { fallbacks: 'default' as const } : {}),
      output_config: { effort: spec.effort },
      system: request.system.map((text) => ({ type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } })),
      mcp_servers: [{ type: 'url', name: MCP_SERVER_NAME, url: request.mcpUrl, authorization_token: request.mcpToken }],
      tools: [{ type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME }],
      messages: messages as never
    });
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'mcp_tool_use') {
        request.onTool?.(event.content_block.name);
      }
    });

    const message = await stream.finalMessage();
    usage.input += message.usage.input_tokens ?? 0;
    usage.output += message.usage.output_tokens ?? 0;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    if (isModelId(message.model)) servedBy = message.model;
    content.push(...(message.content as unknown as Block[]));
    stopReason = message.stop_reason;

    if (stopReason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: message.content as unknown as Block[] });
  }

  const text = content
    .filter((block) => block.type === 'text')
    .map((block) => String(block.text ?? ''))
    .join('')
    .trim();

  const results = new Map<string, { isError: boolean; result: string }>();
  for (const block of content) {
    if (block.type !== 'mcp_tool_result') continue;
    const raw = block.content;
    const result = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map((part: { text?: string }) => part.text ?? '').join('') : '';
    results.set(String(block.tool_use_id), { isError: block.is_error === true, result });
  }
  const toolCalls = content
    .filter((block) => block.type === 'mcp_tool_use')
    .map((block) => {
      const id = String(block.id);
      const outcome = results.get(id);
      return { id, name: String(block.name), input: block.input, isError: outcome?.isError ?? true, result: outcome?.result ?? '' };
    });

  return { text, refused: stopReason === 'refusal', toolCalls, usage, servedBy };
}
