import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble, canChange, isJumbo } from './MessageBubble';
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

const renderBubble = (overrides: Partial<ThreadMessage> = {}, props: Partial<Parameters<typeof MessageBubble>[0]> = {}) =>
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

describe('isJumbo', () => {
  it.each([['❤️'], ['👍'], ['😂😂'], ['🎉🎉🎉']])('treats a short emoji-only message as jumbo (%s)', (body) => {
    expect(isJumbo(body)).toBe(true);
  });

  it('treats a skin-toned emoji as one emoji, not three', () => {
    expect(isJumbo('👍🏽')).toBe(true);
  });

  it.each([['hello'], ['❤️ you'], ['😂😂😂😂'], ['']])('is not jumbo for %s', (body) => {
    expect(isJumbo(body)).toBe(false);
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

describe('canChange', () => {
  const base = message();

  it('lets the sender change a stored message', () => {
    expect(canChange(base, true)).toBe(true);
  });

  it.each([
    ['someone else’s', base, false],
    ['a pending', { ...base, delivery: 'pending' as const }, true],
    ['a failed', { ...base, delivery: 'failed' as const }, true],
    ['an unsent', { ...base, deletedAt: '2026-09-21T10:05:00.000Z' }, true],
    ['a system', { ...base, kind: 'system' as const }, true]
  ])('refuses %s message', (_label, target, mine) => {
    expect(canChange(target, mine)).toBe(false);
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
