jest.mock('./anthropicClient', () => ({ createAnthropic: jest.fn() }));

import { createAnthropic } from './anthropicClient';
import { askClaude, MCP_SERVER_NAME, type ClaudeRequest } from './assistantClaude';

const stream = jest.fn();
beforeEach(() => {
  stream.mockReset();
  (createAnthropic as jest.Mock).mockReset().mockReturnValue({ beta: { messages: { stream } } });
});

type Message = { content: unknown[]; stop_reason: string; model?: string; usage?: Record<string, number | null | { web_search_requests: number }> };

/** What the SDK's stream is, as far as this code uses it: a way to listen, and the finished message. */
const fakeStream = (message: Message, events: unknown[] = []) => {
  const listeners: Array<(event: unknown) => void> = [];
  return {
    on: (_name: string, listener: (event: unknown) => void) => listeners.push(listener),
    finalMessage: async () => {
      for (const event of events) listeners.forEach((listener) => listener(event));
      return { model: 'claude-sonnet-5-5', usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 2 }, ...message };
    }
  };
};
const text = (value: string) => ({ type: 'text', text: value });

const request = (overrides: Partial<ClaudeRequest> = {}): ClaudeRequest => ({
  apiKey: 'sk-ant-test',
  model: 'claude-sonnet-5-5',
  system: ['base prompt', 'bot prompt'],
  user: 'hello there',
  mcpUrl: 'https://mcp.test/mcp',
  mcpToken: 'tmb_live_abc_def',
  ...overrides
});

describe('what is sent to Claude', () => {
  it('names the model, hands over the tools with the person’s own key, and caches both parts of the system prompt', async () => {
    stream.mockReturnValue(fakeStream({ content: [text('hi')], stop_reason: 'end_turn' }));

    await askClaude(request());

    expect(createAnthropic).toHaveBeenCalledWith('sk-ant-test');
    const body = stream.mock.calls[0]![0];
    expect(body).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      mcp_servers: [{ type: 'url', name: MCP_SERVER_NAME, url: 'https://mcp.test/mcp', authorization_token: 'tmb_live_abc_def' }],
      tools: [{ type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME }],
      messages: [{ role: 'user', content: 'hello there' }]
    });
    expect(body.system).toEqual([
      { type: 'text', text: 'base prompt', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'bot prompt', cache_control: { type: 'ephemeral' } }
    ]);
  });

  it('asks for a retry on another model when Anthropic declines, for the models that allow it', async () => {
    stream.mockReturnValue(fakeStream({ content: [], stop_reason: 'end_turn' }));
    await askClaude(request({ model: 'claude-opus-5-5' }));
    expect(stream.mock.calls[0]![0]).toMatchObject({ fallbacks: 'default', betas: ['mcp-client-2025-11-20', 'server-side-fallback-2026-07-01'] });
  });

  it('leaves that out for Haiku, which has none, because the request would be refused', async () => {
    stream.mockReturnValue(fakeStream({ content: [], stop_reason: 'end_turn' }));
    await askClaude(request({ model: 'claude-haiku-5-5' }));
    const body = stream.mock.calls[0]![0];
    expect(body.betas).toEqual(['mcp-client-2025-11-20']);
    expect(body).not.toHaveProperty('fallbacks');
  });
});

describe('the web', () => {
  const web = { city: 'Tallinn', country: 'EE', timeZone: 'Europe/Tallinn', maxUses: 5 };

  it('adds search and fetch next to Tumbaland’s tools, placed where the chat is', async () => {
    stream.mockReturnValue(fakeStream({ content: [text('hi')], stop_reason: 'end_turn' }));
    await askClaude(request({ web }));
    expect(stream.mock.calls[0]![0].tools).toEqual([
      { type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME },
      { type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', city: 'Tallinn', country: 'EE', timezone: 'Europe/Tallinn' } },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 }
    ]);
  });

  it('uses the basic versions on Haiku', async () => {
    stream.mockReturnValue(fakeStream({ content: [], stop_reason: 'end_turn' }));
    await askClaude(request({ model: 'claude-haiku-5-5', web }));
    const types = stream.mock.calls[0]![0].tools.map((tool: { type: string }) => tool.type);
    expect(types).toEqual(['mcp_toolset', 'web_search_20250305', 'web_fetch_20250910']);
  });

  it('sends only Tumbaland’s tools when the web is not asked for', async () => {
    stream.mockReturnValue(fakeStream({ content: [], stop_reason: 'end_turn' }));
    await askClaude(request());
    expect(stream.mock.calls[0]![0].tools).toEqual([{ type: 'mcp_toolset', mcp_server_name: MCP_SERVER_NAME }]);
  });

  it('reports a search as it starts and counts the searches across a paused turn', async () => {
    const onTool = jest.fn();
    stream
      .mockReturnValueOnce(
        fakeStream(
          { content: [{ type: 'server_tool_use', id: 's1', name: 'web_search' }], stop_reason: 'pause_turn', usage: { input_tokens: 10, output_tokens: 1, server_tool_use: { web_search_requests: 2 } } },
          [{ type: 'content_block_start', content_block: { type: 'server_tool_use', name: 'web_search' } }]
        )
      )
      .mockReturnValueOnce(fakeStream({ content: [text('Try Rataskaevu 16.')], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } } }));
    const reply = await askClaude(request({ web, onTool }));
    expect(onTool).toHaveBeenCalledWith('web_search');
    expect(reply.usage.webSearches).toBe(3);
    expect(reply.text).toBe('Try Rataskaevu 16.');
  });
});

describe('what comes back', () => {
  it('joins the text and totals the tokens', async () => {
    stream.mockReturnValue(
      fakeStream({ content: [text('Hello '), { type: 'thinking', thinking: '' }, text('there.')], stop_reason: 'end_turn' })
    );
    const reply = await askClaude(request());
    expect(reply).toMatchObject({
      text: 'Hello there.',
      refused: false,
      toolCalls: [],
      usage: { input: 100, output: 10, cacheRead: 5, cacheWrite: 2 },
      servedBy: 'claude-sonnet-5-5'
    });
  });

  it('pairs each tool call with what the tool answered, as text or as blocks, and whether it failed', async () => {
    stream.mockReturnValue(
      fakeStream({
        stop_reason: 'end_turn',
        content: [
          { type: 'mcp_tool_use', id: 'a', name: 'create_collage', input: { title: 'Rome' }, server_name: 'tumbaland' },
          { type: 'mcp_tool_result', tool_use_id: 'a', is_error: false, content: 'Made "Rome" (id 1)' },
          { type: 'mcp_tool_use', id: 'b', name: 'log_day', input: {}, server_name: 'tumbaland' },
          { type: 'mcp_tool_result', tool_use_id: 'b', is_error: true, content: [{ type: 'text', text: 'No such ' }, { type: 'text', text: 'type' }] },
          { type: 'mcp_tool_use', id: 'c', name: 'get_day', input: {}, server_name: 'tumbaland' },
          text('Done.')
        ]
      })
    );

    const { toolCalls } = await askClaude(request());

    expect(toolCalls).toEqual([
      { id: 'a', name: 'create_collage', input: { title: 'Rome' }, isError: false, result: 'Made "Rome" (id 1)' },
      { id: 'b', name: 'log_day', input: {}, isError: true, result: 'No such type' },
      // Never answered, so not taken for a success.
      { id: 'c', name: 'get_day', input: {}, isError: true, result: '' }
    ]);
  });

  it('flags a refusal, and reads a missing token count as none', async () => {
    stream.mockReturnValue(fakeStream({ content: [], stop_reason: 'refusal', usage: { input_tokens: null, output_tokens: 3 } }));
    const reply = await askClaude(request());
    expect(reply.refused).toBe(true);
    expect(reply.usage).toEqual({ input: 0, output: 3, cacheRead: 0, cacheWrite: 0, webSearches: 0 });
  });

  it('says which model answered when a fallback did, and keeps the one asked for when it cannot tell', async () => {
    stream.mockReturnValueOnce(fakeStream({ content: [text('x')], stop_reason: 'end_turn', model: 'claude-opus-5-5' }));
    expect((await askClaude(request())).servedBy).toBe('claude-opus-5-5');
    stream.mockReturnValueOnce(fakeStream({ content: [text('x')], stop_reason: 'end_turn', model: 'something-new' }));
    expect((await askClaude(request())).servedBy).toBe('claude-sonnet-5-5');
  });
});

describe('progress', () => {
  it('reports each tool as Claude starts it, and nothing else', async () => {
    const seen: string[] = [];
    stream.mockReturnValue(
      fakeStream({ content: [text('ok')], stop_reason: 'end_turn' }, [
        { type: 'content_block_start', content_block: { type: 'text', text: '' } },
        { type: 'content_block_start', content_block: { type: 'mcp_tool_use', name: 'search_photos' } },
        { type: 'content_block_delta', delta: {} },
        { type: 'content_block_start', content_block: { type: 'mcp_tool_use', name: 'create_collage' } }
      ])
    );

    await askClaude(request({ onTool: (name) => seen.push(name) }));

    expect(seen).toEqual(['search_photos', 'create_collage']);
  });

  it('works without anyone listening', async () => {
    stream.mockReturnValue(fakeStream({ content: [text('ok')], stop_reason: 'end_turn' }, [{ type: 'content_block_start', content_block: { type: 'mcp_tool_use', name: 'x' } }]));
    await expect(askClaude(request())).resolves.toMatchObject({ text: 'ok' });
  });
});

describe('a turn the server paused', () => {
  it('is continued with what it had said, and the tokens and tool calls of both parts add up', async () => {
    stream
      .mockReturnValueOnce(
        fakeStream({
          stop_reason: 'pause_turn',
          content: [
            { type: 'mcp_tool_use', id: 'a', name: 'view_photos', input: {}, server_name: 'tumbaland' },
            { type: 'mcp_tool_result', tool_use_id: 'a', is_error: false, content: 'photos' }
          ]
        })
      )
      .mockReturnValueOnce(fakeStream({ stop_reason: 'end_turn', content: [text('All done.')] }));

    const reply = await askClaude(request());

    expect(stream).toHaveBeenCalledTimes(2);
    const second = stream.mock.calls[1]![0].messages;
    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({ role: 'assistant' });
    expect(reply.text).toBe('All done.');
    expect(reply.toolCalls).toHaveLength(1);
    expect(reply.usage).toEqual({ input: 200, output: 20, cacheRead: 10, cacheWrite: 4, webSearches: 0 });
  });

  it('is taken as it stands after a few continuations rather than looping on', async () => {
    stream.mockImplementation(() => fakeStream({ stop_reason: 'pause_turn', content: [text('still going')] }));
    const reply = await askClaude(request());
    expect(stream).toHaveBeenCalledTimes(4);
    expect(reply.text).toBe('still goingstill goingstill goingstill going');
  });
});

describe('errors', () => {
  it('lets Anthropic’s error through with its status, for the caller to judge', async () => {
    stream.mockReturnValue({
      on: () => undefined,
      finalMessage: async () => {
        throw Object.assign(new Error('invalid x-api-key'), { status: 401 });
      }
    });
    await expect(askClaude(request())).rejects.toMatchObject({ status: 401 });
  });
});

describe('a tool that runs here', () => {
  it('is offered next to the others, run when Claude stops for it, and the turn goes on with its answer', async () => {
    const run = jest.fn().mockResolvedValue('Noted: Mia is vegetarian');
    const tool = { name: 'remember', description: 'd', input_schema: { type: 'object' }, run };
    stream
      .mockReturnValueOnce(fakeStream({ content: [{ type: 'tool_use', id: 't1', name: 'remember', input: { note: 'Mia is vegetarian' } }], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeStream({ content: [text('Noted!')], stop_reason: 'end_turn' }));

    const reply = await askClaude(request({ clientTools: [tool] }));

    expect(stream.mock.calls[0]![0].tools).toContainEqual({ name: 'remember', description: 'd', input_schema: { type: 'object' } });
    expect(run).toHaveBeenCalledWith({ note: 'Mia is vegetarian' });
    const second = stream.mock.calls[1]![0].messages;
    expect(second[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'Noted: Mia is vegetarian' }] });
    expect(reply.text).toBe('Noted!');
  });

  it('answers an error, and does not stop the reply, when the tool throws', async () => {
    const tool = { name: 'remember', description: 'd', input_schema: {}, run: jest.fn().mockRejectedValue(new Error('db down')) };
    stream
      .mockReturnValueOnce(fakeStream({ content: [{ type: 'tool_use', id: 't1', name: 'remember', input: {} }], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeStream({ content: [text('Could not save that.')], stop_reason: 'end_turn' }));
    const reply = await askClaude(request({ clientTools: [tool] }));
    expect(stream.mock.calls[1]![0].messages[2].content[0]).toMatchObject({ is_error: true, content: 'db down' });
    expect(reply.text).toBe('Could not save that.');
  });
});

describe('the answer, and where it came from', () => {
  it('leaves out the lead-in before our own tool ran', async () => {
    const tool = { name: 'remember', description: 'd', input_schema: {}, run: jest.fn().mockResolvedValue('Noted') };
    stream
      .mockReturnValueOnce(fakeStream({ content: [text('Let me note that.'), { type: 'tool_use', id: 't1', name: 'remember', input: {} }], stop_reason: 'tool_use' }))
      .mockReturnValueOnce(fakeStream({ content: [text('Noted: Mia is vegetarian.')], stop_reason: 'end_turn' }));
    expect((await askClaude(request({ clientTools: [tool] }))).text).toBe('Noted: Mia is vegetarian.');
  });

  it('does not run our tool on the last turn, when nothing could read its answer', async () => {
    const run = jest.fn().mockResolvedValue('Noted');
    const tool = { name: 'remember', description: 'd', input_schema: {}, run };
    stream.mockImplementation(() => fakeStream({ content: [{ type: 'tool_use', id: 't', name: 'remember', input: {} }], stop_reason: 'tool_use' }));
    await askClaude(request({ clientTools: [tool] }));
    expect(stream).toHaveBeenCalledTimes(4);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('lists each cited web page once', async () => {
    const cite = (url: string, title: string) => ({ type: 'web_search_result_location', url, title, cited_text: 'x' });
    stream.mockReturnValue(
      fakeStream({
        content: [
          { type: 'text', text: 'Kolm Sõpra is open till 23.', citations: [cite('https://kolm.ee', 'Kolm Sõpra'), cite('javascript:alert(1)', 'bad')] },
          { type: 'text', text: ' Mains are about 25 EUR.', citations: [cite('https://kolm.ee', 'Kolm Sõpra'), cite('https://menu.ee', '')] }
        ],
        stop_reason: 'end_turn'
      })
    );
    expect((await askClaude(request())).sources).toEqual([
      { url: 'https://kolm.ee', title: 'Kolm Sõpra' },
      { url: 'https://menu.ee', title: 'https://menu.ee' }
    ]);
  });
});
