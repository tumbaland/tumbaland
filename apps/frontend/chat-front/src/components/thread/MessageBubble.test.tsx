import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from './MessageBubble';
import type { ThreadMessage } from '../../types';

const message = (overrides: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u-tom',
  senderEmail: 'tom@example.com',
  senderName: 'Tom',
  kind: 'text',
  body: 'hello',
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: 'client-1',
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-09-21T10:00:00.000Z',
  ...overrides
});

const noop = () => {};

const renderBubble = (
  overrides: Partial<ThreadMessage> = {},
  props: Partial<Parameters<typeof MessageBubble>[0]> = {}
) =>
  render(
    <MessageBubble
      message={message(overrides)}
      mine={false}
      showSender
      onReact={noop}
      onRetry={noop}
      onPickEmoji={noop}
      onOpenMedia={noop}
      {...props}
    />
  );

describe('an assistant\u2019s message', () => {
  const bot = { name: 'Tumbi', color: '#7c3aed' };

  it('is named by the assistant, labelled AI, and not shown as a person', () => {
    renderBubble({ senderId: 'bot:b1', senderName: 'Tumbi', botId: 'b1' }, { bot, senderName: 'Someone Else' });
    expect(screen.getByText('Tumbi')).toBeInTheDocument();
    expect(screen.getByLabelText('Assistant')).toHaveTextContent('AI');
    expect(screen.queryByText('Someone Else')).not.toBeInTheDocument();
  });

  it('keeps a person\u2019s message free of the label', () => {
    renderBubble();
    expect(screen.queryByLabelText('Assistant')).not.toBeInTheDocument();
  });

  it('opens its settings from its name', async () => {
    const onOpenBot = vi.fn();
    renderBubble({ senderId: 'bot:b1', senderName: 'Tumbi', botId: 'b1' }, { bot: { ...bot, id: 'b1' }, onOpenBot });
    await userEvent.click(screen.getByRole('button', { name: 'Tumbi settings' }));
    expect(onOpenBot).toHaveBeenCalledWith('b1');
  });

  it('keeps the name plain once the assistant has been removed', () => {
    renderBubble({ senderId: 'bot:b1', senderName: 'Tumbi', botId: 'b1' }, { bot, onOpenBot: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Tumbi settings' })).not.toBeInTheDocument();
    expect(screen.getByText('Tumbi')).toBeInTheDocument();
  });

  it('shows no header inside a run of its own messages, like a person', () => {
    renderBubble({ botId: 'b1' }, { bot, showSender: false });
    expect(screen.queryByLabelText('Assistant')).not.toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

describe('MessageBubble', () => {
  it('shows the body', () => {
    renderBubble();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('names the sender as they are called now, not as the message saved it', () => {
    renderBubble({ senderName: 'Tom T' }, { senderName: 'Toomas Tahves' });
    expect(screen.getByText('Toomas Tahves')).toBeInTheDocument();
    expect(screen.queryByText('Tom T')).not.toBeInTheDocument();
  });

  it('shows the sender name when asked', () => {
    renderBubble();
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });

  it('hides the sender name on a grouped message', () => {
    renderBubble({}, { showSender: false });
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
  });

  it('never shows the sender name on your own message', () => {
    renderBubble({}, { mine: true });
    expect(screen.queryByText('Tom')).not.toBeInTheDocument();
  });

  it('replaces a deleted message with a note rather than removing it', () => {
    renderBubble({ deletedAt: '2026-09-21T10:05:00.000Z', body: '' });
    expect(screen.getByText('Message unsent')).toBeInTheDocument();
  });

  it('offers options on hover for your own message only', async () => {
    const onPickEmoji = vi.fn();
    const { container, unmount } = renderBubble({}, { mine: true, onPickEmoji });
    await userEvent.hover(container.firstElementChild!);
    await userEvent.click(screen.getByRole('button', { name: 'Message options' }));
    expect(onPickEmoji).toHaveBeenCalledWith('m1', expect.any(HTMLElement));
    unmount();

    const other = renderBubble({}, { mine: false });
    await userEvent.hover(other.container.firstElementChild!);
    expect(screen.getByRole('button', { name: 'Add reaction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Message options' })).not.toBeInTheDocument();
  });

  it('turns a web address into a link that opens in a new tab', () => {
    renderBubble({ body: 'look https://example.com/trip now' });

    const link = screen.getByRole('link', { name: 'https://example.com/trip' });
    expect(link).toHaveAttribute('href', 'https://example.com/trip');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/look/)).toHaveTextContent('look https://example.com/trip now');
  });

  it('shows reactions on the photo, above the album mark', () => {
    renderBubble(
      {
        kind: 'media',
        body: '',
        attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1, albumId: 'a-rome', albumName: 'Rome' }],
        reactions: [{ userId: 'u-irja', name: 'Irja', emoji: '❤️', at: '2026-09-21T10:01:00.000Z' }]
      },
      { onOpenAlbum: noop }
    );

    const reaction = screen.getByRole('button', { name: '❤️, Irja' });
    const album = screen.getByRole('button', { name: 'In Rome. Open album' });
    expect(reaction.compareDocumentPosition(album) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks a photo saved to an album, and opens that album', async () => {
    const onOpenAlbum = vi.fn();
    renderBubble(
      {
        kind: 'media',
        body: '',
        attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1, albumId: 'a-rome', albumName: 'Rome' }]
      },
      { onOpenAlbum }
    );

    await userEvent.click(screen.getByRole('button', { name: 'In Rome. Open album' }));

    expect(onOpenAlbum).toHaveBeenCalledWith('a-rome');
  });

  it('moves the message’s photos from the pencil beside the mark', async () => {
    const onEditAlbum = vi.fn();
    renderBubble(
      {
        kind: 'media',
        body: '',
        attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1, albumId: 'a-rome', albumName: 'Rome' }]
      },
      { onOpenAlbum: () => {}, onEditAlbum }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Change album' }));

    expect(onEditAlbum).toHaveBeenCalledWith('m1');
  });

  it('takes the message’s photos out of their album from the minus beside the pencil', async () => {
    const onRemoveFromAlbum = vi.fn();
    renderBubble(
      {
        kind: 'media',
        body: '',
        attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1, albumId: 'a-rome', albumName: 'Rome' }]
      },
      { onOpenAlbum: () => {}, onRemoveFromAlbum }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove from album' }));

    expect(onRemoveFromAlbum).toHaveBeenCalledWith('m1');
  });

  it('offers no remove button without a handler', () => {
    renderBubble(
      {
        kind: 'media',
        body: '',
        attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1, albumId: 'a-rome', albumName: 'Rome' }]
      },
      { onOpenAlbum: () => {} }
    );
    expect(screen.queryByRole('button', { name: 'Remove from album' })).not.toBeInTheDocument();
  });

  it('shows no album mark on a photo that is not in one', () => {
    renderBubble(
      { kind: 'media', body: '', attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 }] },
      { onOpenAlbum: () => {} }
    );
    expect(screen.queryByText(/^In /)).not.toBeInTheDocument();
  });

  it('draws your own bubble in the theme colour', () => {
    const { container } = renderBubble({}, { mine: true, accent: 'rgb(29, 78, 216)' });
    expect(container.querySelector('p')!.parentElement).toHaveStyle({ backgroundColor: 'rgb(29, 78, 216)' });
  });

  it('marks an edited message', () => {
    renderBubble({ editedAt: '2026-09-21T10:05:00.000Z' });
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('offers a retry on a failed send', async () => {
    const onRetry = vi.fn();
    renderBubble({ delivery: 'failed' }, { onRetry });

    await userEvent.click(screen.getByText(/Tap to retry/));

    // Retried with the same clientId, which is what makes the retry safe.
    expect(onRetry).toHaveBeenCalledWith('client-1');
  });

  it('shows the time on a 24-hour clock', () => {
    renderBubble({ createdAt: '2026-09-21T14:05:00' });

    expect(screen.getByText('14:05')).toBeInTheDocument();
    expect(screen.queryByText(/PM/)).not.toBeInTheDocument();
  });

  it('shows the sender’s picture beside their name', () => {
    const { container } = renderBubble({}, { senderPicture: 'https://auth.example/auth/avatars/u-tom?v=1' });

    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://auth.example/auth/avatars/u-tom?v=1');
  });

  it('falls back to their initial when they have no picture', () => {
    const { container } = renderBubble();

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('shows no timestamp on a failed message, since it never arrived', () => {
    renderBubble({ delivery: 'failed' });
    expect(screen.getByText(/Not sent/)).toBeInTheDocument();
  });

  it('renders reactions grouped with a count', () => {
    renderBubble({
      reactions: [
        { userId: 'u-irja', name: 'Irja', emoji: '❤️', at: '2026-09-21T10:01:00.000Z' },
        { userId: 'u-tom', name: 'Tom', emoji: '❤️', at: '2026-09-21T10:02:00.000Z' }
      ]
    });

    expect(screen.getByRole('button', { name: /Irja, Tom/ })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('toggles a reaction when its chip is clicked', async () => {
    const onReact = vi.fn();
    renderBubble(
      { reactions: [{ userId: 'u-irja', name: 'Irja', emoji: '❤️', at: '2026-09-21T10:01:00.000Z' }] },
      { onReact }
    );

    await userEvent.click(screen.getByRole('button', { name: /Irja/ }));

    expect(onReact).toHaveBeenCalledWith('m1', '❤️');
  });

  it('renders a photo as an openable tile', () => {
    renderBubble({
      body: '',
      attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 100, url: 'https://files/f1' }]
    });

    expect(screen.getByRole('button', { name: 'Open photo' })).toBeInTheDocument();
  });

  it('opens the lightbox at the tile that was tapped', async () => {
    const onOpenMedia = vi.fn();
    renderBubble(
      {
        body: '',
        attachments: [
          { fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 100, url: 'https://files/f1' },
          { fileId: 'f2', mimetype: 'image/jpeg', sizeBytes: 100, url: 'https://files/f2' }
        ]
      },
      { onOpenMedia }
    );

    await userEvent.click(screen.getAllByRole('button', { name: 'Open photo' })[1]!);

    expect(onOpenMedia).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), 1);
  });
});

describe('long press', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const bubbleOf = (container: HTMLElement) => container.querySelector('p')!.parentElement!;

  it('opens the reaction picker after a held touch', () => {
    // Touch has no hover, so the button beside the bubble can never appear.
    const onPickEmoji = vi.fn();
    const { container } = renderBubble({}, { onPickEmoji });

    fireEvent.touchStart(bubbleOf(container));
    vi.advanceTimersByTime(500);

    expect(onPickEmoji).toHaveBeenCalledWith('m1', expect.any(HTMLElement));
  });

  it('does not fire on a quick tap', () => {
    const onPickEmoji = vi.fn();
    const { container } = renderBubble({}, { onPickEmoji });

    fireEvent.touchStart(bubbleOf(container));
    vi.advanceTimersByTime(100);
    fireEvent.touchEnd(bubbleOf(container));
    vi.advanceTimersByTime(500);

    expect(onPickEmoji).not.toHaveBeenCalled();
  });

  it('does not fire when the finger moves, which is a scroll', () => {
    const onPickEmoji = vi.fn();
    const { container } = renderBubble({}, { onPickEmoji });

    fireEvent.touchStart(bubbleOf(container));
    fireEvent.touchMove(bubbleOf(container));
    vi.advanceTimersByTime(500);

    expect(onPickEmoji).not.toHaveBeenCalled();
  });

  it('does nothing on a message that is still sending', () => {
    const onPickEmoji = vi.fn();
    const { container } = renderBubble({ delivery: 'pending' }, { onPickEmoji });

    fireEvent.touchStart(bubbleOf(container));
    vi.advanceTimersByTime(500);

    expect(onPickEmoji).not.toHaveBeenCalled();
  });
});

describe('message effects', () => {
  it('draws hearts around a message sent with them', () => {
    renderBubble({ effect: 'hearts', body: 'miss you' });
    expect(screen.getByTestId('bubble-effect-hearts')).toBeInTheDocument();
  });

  it('draws nothing around an ordinary message', () => {
    renderBubble();
    expect(screen.queryByTestId(/bubble-effect/)).not.toBeInTheDocument();
  });

  it('takes the effect away with an unsent message', () => {
    renderBubble({ effect: 'kisses', deletedAt: '2026-09-21T10:05:00.000Z' });
    expect(screen.queryByTestId(/bubble-effect/)).not.toBeInTheDocument();
  });
});

describe('voice messages', () => {
  it('draws a player in the bubble rather than a photo tile', () => {
    const { container } = renderBubble({
      kind: 'media',
      body: '',
      attachments: [{ fileId: 'v1', mimetype: 'audio/webm', sizeBytes: 1, durationMs: 4_000, url: 'https://files.test/v1.weba' }]
    });

    expect(screen.getByLabelText('Play voice message')).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
    expect(container.querySelector('img, video')).toBeNull();
  });
});

describe('replies', () => {
  const quote = { name: 'Irja', text: 'dinner at 7?', unsent: false };

  it('quotes the message it answers above its own text', () => {
    renderBubble({ body: 'yes!' }, { quote });

    const quoted = screen.getByText('dinner at 7?');
    expect(screen.getByText('Irja')).toBeInTheDocument();
    expect(quoted.compareDocumentPosition(screen.getByText('yes!')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('goes to the original from the quote', async () => {
    const onOpen = vi.fn();
    renderBubble({ body: 'yes!' }, { quote: { ...quote, onOpen } });

    await userEvent.click(screen.getByRole('button', { name: /Reply to Irja: dinner at 7\?/ }));

    expect(onOpen).toHaveBeenCalled();
  });

  it('says so when the original was unsent', () => {
    renderBubble({ body: 'yes!' }, { quote: { ...quote, text: '', unsent: true } });
    expect(screen.getByText('Message unsent')).toBeInTheDocument();
  });

  it('keeps an emoji reply in its bubble, under the quote', () => {
    renderBubble({ body: '❤️' }, { quote });
    expect(screen.getByText('❤️').tagName).toBe('P');
    expect(screen.getByText('❤️')).not.toHaveClass('MuiTypography-h3');
  });

  it('replies from the button beside the bubble', async () => {
    const onReply = vi.fn();
    const { container } = renderBubble({}, { onReply });

    fireEvent.mouseEnter(container.firstChild as Element);
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(onReply).toHaveBeenCalledWith('m1');
  });

  const swipe = (target: Element, dx: number, dy: number) => {
    fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(target, { touches: [{ clientX: 100 + dx / 2, clientY: 100 + dy / 2 }] });
    fireEvent.touchMove(target, { touches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
    fireEvent.touchEnd(target);
  };

  it('replies to a bubble swiped to the right', () => {
    const onReply = vi.fn();
    renderBubble({ body: 'swipe me' }, { onReply });

    swipe(screen.getByText('swipe me').parentElement!, 80, 4);

    expect(onReply).toHaveBeenCalledWith('m1');
  });

  it('leaves a scroll alone, and a swipe too short to mean it', () => {
    const onReply = vi.fn();
    renderBubble({ body: 'swipe me' }, { onReply });
    const bubble = screen.getByText('swipe me').parentElement!;

    swipe(bubble, 20, 120);
    swipe(bubble, 30, 0);

    expect(onReply).not.toHaveBeenCalled();
  });

  it('offers no reply on a message still sending', () => {
    const onReply = vi.fn();
    const { container } = renderBubble({ delivery: 'pending' }, { onReply });
    fireEvent.mouseEnter(container.firstChild as Element);
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  });
});

describe('double tap for a heart', () => {
  const tap = (target: Element) => {
    fireEvent.touchStart(target, { touches: [{ clientX: 50, clientY: 50 }] });
    fireEvent.touchEnd(target);
  };

  it('hearts a message tapped twice, and shows it', () => {
    const onLove = vi.fn();
    renderBubble({ body: 'love you' }, { onLove });
    const bubble = screen.getByText('love you').parentElement!;

    tap(bubble);
    tap(bubble);

    expect(onLove).toHaveBeenCalledWith('m1');
    expect(screen.getByTestId('heart-burst')).toBeInTheDocument();
  });

  it('takes one tap as just a tap', () => {
    const onLove = vi.fn();
    renderBubble({ body: 'love you' }, { onLove });

    tap(screen.getByText('love you').parentElement!);

    expect(onLove).not.toHaveBeenCalled();
  });

  it('hearts a message double-clicked on a computer', () => {
    const onLove = vi.fn();
    renderBubble({ body: 'love you' }, { onLove });

    fireEvent.doubleClick(screen.getByText('love you').parentElement!);

    expect(onLove).toHaveBeenCalledTimes(1);
  });

  it('ignores the double click a phone sends after a double tap, so it is one heart', () => {
    const onLove = vi.fn();
    renderBubble({ body: 'love you' }, { onLove });
    const bubble = screen.getByText('love you').parentElement!;

    tap(bubble);
    tap(bubble);
    fireEvent.doubleClick(bubble);

    expect(onLove).toHaveBeenCalledTimes(1);
  });

  it('does not count a cancelled touch as a tap', () => {
    const onLove = vi.fn();
    renderBubble({ body: 'love you' }, { onLove });
    const bubble = screen.getByText('love you').parentElement!;

    tap(bubble);
    fireEvent.touchStart(bubble, { touches: [{ clientX: 50, clientY: 50 }] });
    fireEvent.touchCancel(bubble);

    expect(onLove).not.toHaveBeenCalled();
  });

  it('leaves a message still sending alone', () => {
    const onLove = vi.fn();
    renderBubble({ body: 'love you', delivery: 'pending' }, { onLove });
    fireEvent.doubleClick(screen.getByText('love you').parentElement!);
    expect(onLove).not.toHaveBeenCalled();
  });
});
