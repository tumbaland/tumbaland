import { createAnthropic } from './anthropicClient';
import { MODELS, isModelId, type ModelId, type ModelSpec, type TokenUsage } from './assistantModels';

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

/**
 * A tool that runs here, not at Anthropic: the one kind that knows which
 * conversation it is in. Claude stops to ask for it, and the turn continues
 * with what it answered.
 */
export interface ClientTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** What to tell Claude happened. Never throws: a failure is an answer too. */
  run: (input: unknown) => Promise<string>;
}

/** A paused turn, or one waiting on a tool of ours, is resumed this many times at most, then taken as it stands. */
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
  /**
   * Lets Claude search the web and read pages. Left out, it has only Tumbaland's
   * tools. The place is where the chat is, so "tonight" and "near me" mean something.
   */
  web?: { city: string; country: string; timeZone: string; maxUses: number };
  /** Tools that run here, next to Tumbaland's. */
  clientTools?: ClientTool[];
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
  /** The web pages the answer cites, each once, in the order first cited. */
  sources: Source[];
}

export interface Source {
  url: string;
  title: string;
}

/** Web search citations are on every text block that drew on a result: kept once per page. */
function sourcesOf(blocks: Block[]): Source[] {
  const seen = new Map<string, Source>();
  for (const block of blocks) {
    if (!Array.isArray(block.citations)) continue;
    for (const citation of block.citations as Array<Record<string, unknown>>) {
      const url = typeof citation.url === 'string' ? citation.url : '';
      if (!/^https?:\/\//.test(url) || seen.has(url)) continue;
      seen.set(url, { url, title: typeof citation.title === 'string' && citation.title.trim() ? citation.title.trim() : url });
    }
  }
  return [...seen.values()];
}

type Block = { type: string } & Record<string, unknown>;

/** One result for every call to a tool of ours, in a single message, as the API asks. */
async function runClientTools(content: Block[], tools: ClientTool[]): Promise<Block[]> {
  const calls = content.filter((block) => block.type === 'tool_use');
  return Promise.all(
    calls.map(async (call) => {
      const tool = tools.find((candidate) => candidate.name === call.name);
      if (!tool) return { type: 'tool_result', tool_use_id: String(call.id), content: `There is no tool called ${String(call.name)}.`, is_error: true };
      try {
        return { type: 'tool_result', tool_use_id: String(call.id), content: await tool.run(call.input) };
      } catch (error) {
        return { type: 'tool_result', tool_use_id: String(call.id), content: (error as Error).message || 'That failed.', is_error: true };
      }
    })
  );
}

/** Anthropic's web tools, run on their side: nothing to execute here, and no result to read back. */
function webTools(request: ClaudeRequest, spec: ModelSpec): Block[] {
  const { web } = request;
  if (!web) return [];
  return [
    {
      type: spec.webTools.search,
      name: 'web_search',
      max_uses: web.maxUses,
      user_location: { type: 'approximate', city: web.city, country: web.country, timezone: web.timeZone }
    },
    { type: spec.webTools.fetch, name: 'web_fetch', max_uses: web.maxUses }
  ];
}

export async function askClaude(request: ClaudeRequest): Promise<ClaudeReply> {
  const client = createAnthropic(request.apiKey);
  const spec = MODELS[request.model];
  const betas = ['mcp-client-2025-11-20', ...(spec.fallbacks ? ['server-side-fallback-2026-07-01'] : [])];

  const messages: Array<{ role: 'user' | 'assistant'; content: string | Block[] }> = [{ role: 'user', content: request.user }];
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const content: Block[] = [];
  let servedBy: ModelId = request.model;
  let stopReason: string | null = null;
  /** What was said since our last tool ran: a paused turn's answer goes on in the next one. */
  let sinceTools: Block[] = [];

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
      tools: [
        { type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME },
        ...webTools(request, spec),
        ...(request.clientTools ?? []).map(({ name, description, input_schema }) => ({ name, description, input_schema }))
      ] as never,
      messages: messages as never
    });
    stream.on('streamEvent', (event) => {
      if (event.type !== 'content_block_start') return;
      // Tumbaland's, Anthropic's own (a web search) and ours are different block types with the same name field.
      const block = event.content_block;
      if (block.type === 'mcp_tool_use' || block.type === 'server_tool_use' || block.type === 'tool_use') request.onTool?.(block.name);
    });

    const message = await stream.finalMessage();
    usage.input += message.usage.input_tokens ?? 0;
    usage.output += message.usage.output_tokens ?? 0;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    usage.webSearches = (usage.webSearches ?? 0) + (message.usage.server_tool_use?.web_search_requests ?? 0);
    if (isModelId(message.model)) servedBy = message.model;
    content.push(...(message.content as unknown as Block[]));
    sinceTools.push(...(message.content as unknown as Block[]));
    stopReason = message.stop_reason;

    // On the last turn there is no next one to read a tool's answer, so it is not run: a note
    // saved that the reply never mentions is worse than one not saved.
    if (stopReason === 'tool_use' && turn < MAX_CONTINUATIONS) {
      sinceTools = [];
      messages.push({ role: 'assistant', content: message.content as unknown as Block[] });
      messages.push({ role: 'user', content: await runClientTools(message.content as unknown as Block[], request.clientTools ?? []) });
      continue;
    }
    if (stopReason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: message.content as unknown as Block[] });
  }

  // The answer is what was said after our last tool ran. What came before was a lead-in to it
  // ("I'll note that"), and joined to the answer it reads as one run-on sentence.
  const textOf = (blocks: Block[]) => blocks.filter((block) => block.type === 'text');
  const answer = textOf(sinceTools).some((block) => String(block.text ?? '').trim()) ? textOf(sinceTools) : textOf(content);
  const text = answer
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

  return { text, refused: stopReason === 'refusal', toolCalls, usage, servedBy, sources: sourcesOf(answer) };
}
