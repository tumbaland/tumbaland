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

  it('says so when unsending fails', async () => {
    const given = props({ onUnsend: vi.fn(async () => Promise.reject(new Error('offline'))) });
    render(<ThreadMessageActions {...given} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Unsend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unsend' }));

    expect(given.onError).toHaveBeenCalledWith('Could not unsend that message. Try again.');
  });
});
