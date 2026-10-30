import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageList } from './MessageList';
import type { ThreadMessage } from '../../types';

/**
 * jsdom has no layout, so the list is given one: a viewport of 500px over
 * content whose height the test controls, and a scroll offset clamped the way
 * a browser clamps it. The resize observer is captured so a test can say
 * "the photos above just finished loading".
 */
let contentHeight = 2000;
const VIEWPORT = 500;
let resized: (() => void) | null = null;

class FakeResizeObserver {
  constructor(callback: () => void) {
    resized = callback;
  }
  observe() {}
  disconnect() {}
}

const message = (index: number): ThreadMessage => ({
  id: `m${index}`,
  conversationId: 'c1',
  senderId: index % 2 ? 'u-tom' : 'u-irja',
  senderEmail: '',
  senderName: index % 2 ? 'Tom' : 'Irja',
  kind: 'text',
  body: `message ${index}`,
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: `client-${index}`,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date(Date.UTC(2026, 8, 22, 10, index)).toISOString()
});

function renderList() {
  const utils = render(
    <MessageList
      messages={Array.from({ length: 30 }, (_, index) => message(index))}
      currentUserId="u-tom"
      hasOlder={false}
      loadingOlder={false}
      onLoadOlder={() => {}}
      onReact={() => {}}
      onRetry={() => {}}
      onPickEmoji={() => {}}
      onOpenMedia={() => {}}
    />
  );
  return { ...utils, list: screen.getByRole('log') };
}

beforeEach(() => {
  contentHeight = 2000;
  resized = null;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);

  let top = 0;
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => contentHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => VIEWPORT);
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, contentHeight - VIEWPORT));
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bottom = () => contentHeight - VIEWPORT;

describe('MessageList scrolling', () => {
  it('opens at the newest message', () => {
    const { list } = renderList();
    expect(list.scrollTop).toBe(bottom());
  });

  it('stays at the newest message when photos load after its own jump to the bottom', () => {
    const { list } = renderList();

    // Photos above finish loading before the scroll event from the jump is
    // handled: that event now reads a big gap to the bottom.
    contentHeight = 2900;
    fireEvent.scroll(list);
    resized!();

    // It was the content that moved, not the reader, so it follows.
    expect(list.scrollTop).toBe(bottom());
  });

  it('leaves a reader who scrolled up where they are when content grows', () => {
    const { list } = renderList();

    list.scrollTop = 600;
    fireEvent.scroll(list);
    contentHeight = 2900;
    resized!();

    expect(list.scrollTop).toBe(600);
  });

  it('follows again once the reader scrolls back down to the bottom', () => {
    const { list } = renderList();
    list.scrollTop = 600;
    fireEvent.scroll(list);

    list.scrollTop = bottom();
    fireEvent.scroll(list);
    contentHeight = 2900;
    resized!();

    expect(list.scrollTop).toBe(bottom());
  });

  it('shows a reminder card that opens the plan', () => {
    const onOpenPlan = vi.fn();
    render(
      <MessageList
        messages={[
          {
            ...message(1),
            kind: 'reminder',
            senderId: 'tumbaland-reminders',
            senderName: 'Reminder',
            body: 'Concert on Friday 16 October at 19:00',
            plan: { id: 'p1', title: 'Concert', date: '2026-10-16', time: '19:00', timeZone: 'Europe/Tallinn', place: null }
          }
        ]}
        currentUserId="u-irja"
        hasOlder={false}
        loadingOlder={false}
        onLoadOlder={() => {}}
        onReact={() => {}}
        onRetry={() => {}}
        onPickEmoji={() => {}}
        onOpenMedia={() => {}}
        onOpenPlan={onOpenPlan}
      />
    );

    expect(screen.getByTestId('reminder-card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onOpenPlan).toHaveBeenCalledWith('p1');
  });

  it('shows a collage card that opens the collage', () => {
    const onOpenCollage = vi.fn();
    render(
      <MessageList
        messages={[{ ...message(1), kind: 'collage', body: '', collage: { id: 'k1', title: 'Rome' } }]}
        currentUserId="u-irja"
        hasOlder={false}
        loadingOlder={false}
        onLoadOlder={() => {}}
        onReact={() => {}}
        onRetry={() => {}}
        onPickEmoji={() => {}}
        onOpenMedia={() => {}}
        onOpenCollage={onOpenCollage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onOpenCollage).toHaveBeenCalledWith('k1');
  });
});

describe('opening a message from search', () => {
  const list30 = Array.from({ length: 30 }, (_, index) => message(index));
  const element = (focus: { id: string; key: number } | null) => (
    <MessageList
      messages={list30}
      currentUserId="u-tom"
      hasOlder={false}
      loadingOlder={false}
      onLoadOlder={() => {}}
      onReact={() => {}}
      onRetry={() => {}}
      onPickEmoji={() => {}}
      onOpenMedia={() => {}}
      focus={focus}
    />
  );

  beforeEach(() => {
    // The list's own box at 0, and the message 100px below it.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = this.getAttribute('data-message-id') === 'm5' ? 100 : 0;
      return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
  });

  it('brings the message to the middle of the list', () => {
    const { rerender } = render(element(null));
    const list = screen.getByRole('log');
    expect(list.scrollTop).toBe(bottom());

    rerender(element({ id: 'm5', key: 1 }));

    // From the bottom, down by its 100px offset, up by half the viewport.
    expect(list.scrollTop).toBe(bottom() + 100 - VIEWPORT / 2);
  });

  it('stays on the message when photos below it finish loading', () => {
    const { rerender } = render(element(null));
    const list = screen.getByRole('log');
    rerender(element({ id: 'm5', key: 1 }));
    const there = list.scrollTop;

    contentHeight = 2900;
    resized!();

    expect(list.scrollTop).toBe(there);
  });

  it('marks every message row with its id, for finding it', () => {
    render(element(null));
    expect(document.querySelector('[data-message-id="m5"]')).toHaveTextContent('message 5');
  });
});

describe('grouping', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 8, 22, 10, minute)).toISOString();
  const from = (index: number, senderId: string, minute: number): ThreadMessage => ({
    ...message(index),
    senderId,
    senderName: senderId === 'u-tom' ? 'Tom' : 'Irja',
    createdAt: at(minute)
  });

  const renderMessages = (messages: ThreadMessage[], members = 2) =>
    render(
      <MessageList
        messages={messages}
        currentUserId="u-tom"
        hasOlder={false}
        loadingOlder={false}
        onLoadOlder={() => {}}
        onReact={() => {}}
        onRetry={() => {}}
        onPickEmoji={() => {}}
        onOpenMedia={() => {}}
        members={['u-tom', 'u-irja', 'u-mari'].slice(0, members).map((userId) => ({
          userId,
          email: '',
          name: userId === 'u-tom' ? 'Tom' : userId === 'u-irja' ? 'Irja' : 'Mari',
          joinedAt: ''
        }))}
      />
    );

  it('names the other person between two people too, so assistants can be told apart', () => {
    renderMessages([from(0, 'u-irja', 0)]);
    expect(screen.getByText('Irja')).toBeInTheDocument();
  });

  it('names a run of messages once, above its first', () => {
    renderMessages([from(0, 'u-irja', 0), from(1, 'u-irja', 1)]);
    expect(screen.getAllByText('Irja')).toHaveLength(1);
  });

  it('does not name your own messages', () => {
    renderMessages([from(0, 'u-tom', 0)]);
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
  });

  it('names the sender in a group', () => {
    renderMessages([from(0, 'u-irja', 0)], 3);
    expect(screen.getByText('Irja')).toBeInTheDocument();
  });

  it('times a run of messages once, under its last', () => {
    renderMessages([from(0, 'u-irja', 0), from(1, 'u-irja', 1), from(2, 'u-tom', 1)]);
    // Irja's two, a minute apart, show one time between them; Tom's has its own.
    expect(screen.getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(2);
  });

  it('times each message that is further apart than the run allows', () => {
    renderMessages([from(0, 'u-irja', 0), from(1, 'u-irja', 10)]);
    expect(screen.getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(2);
  });
});

describe('reply quotes', () => {
  const base = (overrides: Partial<ThreadMessage>): ThreadMessage => ({ ...message(0), ...overrides });

  const renderThread = (messages: ThreadMessage[], onOpenQuote = vi.fn()) =>
    render(
      <MessageList
        messages={messages}
        currentUserId="u-tom"
        hasOlder={false}
        loadingOlder={false}
        onLoadOlder={() => {}}
        onReact={() => {}}
        onRetry={() => {}}
        onPickEmoji={() => {}}
        onOpenMedia={() => {}}
        onOpenQuote={onOpenQuote}
      />
    );

  it('quotes the original from the thread, calling your own "You"', () => {
    renderThread([
      base({ id: 'p', clientId: 'p', senderId: 'u-tom', body: 'dinner at 7?' }),
      base({ id: 'r', clientId: 'r', senderId: 'u-irja', body: 'yes', replyTo: 'p', createdAt: new Date(Date.UTC(2026, 8, 22, 11)).toISOString() })
    ]);

    expect(screen.getByRole('button', { name: 'Reply to You: dinner at 7?. Show it' })).toBeInTheDocument();
  });

  it('falls back to the copy on the reply when the original is not loaded, and goes back to it', () => {
    const onOpenQuote = vi.fn();
    renderThread(
      [
        base({
          id: 'r',
          clientId: 'r',
          senderId: 'u-irja',
          body: 'yes',
          replyTo: 'far-back',
          quote: { senderId: 'u-tom', senderName: 'Tom', text: 'remember Rome?', createdAt: '2026-01-25T10:00:00.000Z' }
        })
      ],
      onOpenQuote
    );

    fireEvent.click(screen.getByRole('button', { name: /remember Rome\?/ }));

    expect(onOpenQuote).toHaveBeenCalledWith('far-back', '2026-01-25T10:00:00.000Z');
  });

  it('shows an unsent original as unsent, with nothing to go to', () => {
    renderThread([
      base({ id: 'p', clientId: 'p', senderId: 'u-tom', body: '', deletedAt: '2026-09-22T10:05:00.000Z' }),
      base({ id: 'r', clientId: 'r', senderId: 'u-irja', body: 'yes', replyTo: 'p', createdAt: new Date(Date.UTC(2026, 8, 22, 11)).toISOString() })
    ]);

    expect(screen.getAllByText('Message unsent')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Show it/ })).not.toBeInTheDocument();
  });
});

describe('double tap for a heart', () => {
  const renderOne = (onReact: (id: string, emoji: string) => void, reactions: ThreadMessage['reactions'] = []) =>
    render(
      <MessageList
        messages={[{ ...message(0), body: 'love you', reactions }]}
        currentUserId="u-tom"
        hasOlder={false}
        loadingOlder={false}
        onLoadOlder={() => {}}
        onReact={onReact}
        onRetry={() => {}}
        onPickEmoji={() => {}}
        onOpenMedia={() => {}}
      />
    );

  it('sends a heart once, however fast the double clicks come', () => {
    const onReact = vi.fn();
    renderOne(onReact);
    const bubble = screen.getByText('love you').parentElement!;

    fireEvent.doubleClick(bubble);
    fireEvent.doubleClick(bubble);

    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onReact).toHaveBeenCalledWith('m0', '❤️');
  });

  it('never takes a heart off that is already there', () => {
    const onReact = vi.fn();
    renderOne(onReact, [{ userId: 'u-tom', name: 'Tom', emoji: '❤️', at: '2026-09-22T10:00:00.000Z' }]);

    fireEvent.doubleClick(screen.getByText('love you').parentElement!);

    expect(onReact).not.toHaveBeenCalled();
  });
});

describe('what assistants wrote', () => {
  const botMessage = (index: number, botId: string, savedName: string): ThreadMessage => ({
    ...message(index),
    senderId: `bot:${botId}`,
    senderName: savedName,
    botId
  });
  const render1 = (messages: ThreadMessage[], bots?: Array<{ id: string; name: string; color: string }>) =>
    render(
      <MessageList
        messages={messages}
        currentUserId="u-tom"
        hasOlder={false}
        loadingOlder={false}
        onLoadOlder={() => {}}
        onReact={() => {}}
        onRetry={() => {}}
        onPickEmoji={() => {}}
        onOpenMedia={() => {}}
        bots={bots as never}
        members={[{ userId: 'u-tom', email: '', name: 'Tom', joinedAt: '' }, { userId: 'u-irja', email: '', name: 'Irja', joinedAt: '' }]}
      />
    );

  it('are labelled, and called what the assistant is called now, not what it was when it wrote', () => {
    render1([botMessage(2, 'b1', 'Tumbi')], [{ id: 'b1', name: 'Mochi', color: '#7c3aed' }]);
    expect(screen.getByLabelText('Assistant')).toHaveTextContent('AI');
    expect(screen.getByText('Mochi')).toBeInTheDocument();
    expect(screen.queryByText('Tumbi')).not.toBeInTheDocument();
  });

  it('stay in the thread, under the name they were written with, when the assistant is gone', () => {
    render1([botMessage(2, 'b1', 'Tumbi')], []);
    expect(screen.getByText('Tumbi')).toBeInTheDocument();
    expect(screen.getByLabelText('Assistant')).toBeInTheDocument();
  });

  it('are still labelled before the assistants have loaded', () => {
    render1([botMessage(2, 'b1', 'Tumbi')]);
    expect(screen.getByLabelText('Assistant')).toBeInTheDocument();
  });

  it('are named once per run, and a person’s messages never get the label', () => {
    render1([message(1), botMessage(2, 'b1', 'Tumbi'), botMessage(3, 'b1', 'Tumbi')], [{ id: 'b1', name: 'Tumbi', color: '#7c3aed' }]);
    expect(screen.getAllByLabelText('Assistant')).toHaveLength(1);
    expect(screen.getAllByText('Tumbi')).toHaveLength(1);
  });
});
