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
