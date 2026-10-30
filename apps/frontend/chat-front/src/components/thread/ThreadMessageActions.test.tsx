import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The full picker registers a custom element; it stands in as one emoji.
vi.mock('./FullEmojiPicker', () => ({
  loadEmojiPicker: () => Promise.resolve(),
  FullEmojiPicker: ({ anchorEl, onPick }: { anchorEl: HTMLElement | null; onPick: (emoji: string) => void }) =>
    anchorEl ? (
      <button type="button" onClick={() => onPick('🦄')}>
        unicorn
      </button>
    ) : null
}));

import { ThreadMessageActions } from './ThreadMessageActions';
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
  createdAt: '2026-10-22T10:00:00.000Z',
  ...overrides
});

const props = (overrides: Partial<Parameters<typeof ThreadMessageActions>[0]> = {}) => ({
  picked: { messageId: 'm1', anchor: document.body },
  onClose: vi.fn(),
  messages: [message()],
  currentUserId: 'u-tom',
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onEditAlbum: vi.fn(),
  onReact: vi.fn(async () => {}),
  onUnsend: vi.fn(async () => {}),
  onError: vi.fn(),
  ...overrides
});

describe('ThreadMessageActions', () => {
  it('offers reply, edit and unsend on your own message', async () => {
    const given = props();
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Reply' }));
    expect(given.onReply).toHaveBeenCalledWith('m1');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Unsend' })).toBeInTheDocument();
  });

  it('offers no edit or unsend on someone else’s, and an album only for photos', async () => {
    const given = props({
      messages: [
        message({
          senderId: 'u-irja',
          attachments: [{ fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1, albumId: 'a1', albumName: 'Rome' }]
        })
      ]
    });
    render(<ThreadMessageActions {...given} />);

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change album…' }));
    expect(given.onEditAlbum).toHaveBeenCalledWith('m1');
  });

  it('reacts from the quick row and from the full picker', async () => {
    const given = props();
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('button', { name: '❤️' }));
    expect(given.onReact).toHaveBeenCalledWith('m1', '❤️');

    await userEvent.click(screen.getByRole('button', { name: 'More emoji' }));
    // Outside the reaction popover, which hides the rest of the page from queries by role.
    await userEvent.click(screen.getByText('unicorn'));
    expect(given.onReact).toHaveBeenCalledWith('m1', '🦄');
  });

  it('asks before unsending, and can be talked out of it', async () => {
    const given = props();
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Unsend' }));
    expect(screen.getByText('Unsend this message?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(given.onUnsend).not.toHaveBeenCalled();
  });

  it('unsends once confirmed', async () => {
    const given = props();
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Unsend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unsend' }));

    expect(given.onUnsend).toHaveBeenCalledWith('m1');
  });

  it('copies what a message says, whoever wrote it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const given = props({ messages: [message({ senderId: 'u-irja', body: 'Suši haus, 21:15' })] });
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('Suši haus, 21:15');
    expect(given.onError).not.toHaveBeenCalled();
  });

  it('opens the text on its own so part of it can be selected, and closes again', async () => {
    const given = props({ messages: [message({ senderId: 'u-irja', body: 'Suši haus,\nkristiine 21:15' })] });
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Select text' }));
    const dialog = screen.getByRole('dialog', { name: 'Select text' });
    expect(dialog).toHaveTextContent('Suši haus, kristiine 21:15');
    expect(getComputedStyle(screen.getByText(/kristiine/)).userSelect).toBe('text');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select text' })).not.toBeInTheDocument());
  });

  it('says so when the phone will not let it copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    const given = props();
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));

    await vi.waitFor(() => expect(given.onError).toHaveBeenCalledWith('Could not copy that message.'));
  });

  it('offers no copy where there is no text: a photo alone, an unsent message, or a line from the chat itself', () => {
    const photo = { fileId: 'f1', mimetype: 'image/jpeg', sizeBytes: 1 };
    const none = (overrides: Partial<ThreadMessage>) => {
      const { unmount } = render(<ThreadMessageActions {...props({ messages: [message(overrides)] })} />);
      expect(screen.queryByRole('menuitem', { name: 'Copy' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Select text' })).not.toBeInTheDocument();
      unmount();
    };
    none({ body: '', attachments: [photo] });
    none({ deletedAt: '2026-10-22T10:05:00.000Z' });
    none({ kind: 'system', body: 'Tom changed the theme' });
  });

  it('says so when unsending fails', async () => {
    const given = props({ onUnsend: vi.fn(async () => Promise.reject(new Error('offline'))) });
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Unsend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unsend' }));

    expect(given.onError).toHaveBeenCalledWith('Could not unsend that message. Try again.');
  });
});
