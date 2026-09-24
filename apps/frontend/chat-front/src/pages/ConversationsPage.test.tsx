import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const ensureMyConversations = vi.fn();
const navigate = vi.fn();

vi.mock('../services/chatApi', () => ({
  chatApi: { ensureMyConversations: () => ensureMyConversations() }
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

// The list's live connection, captured so a test can play events into it.
let streamEvents: ((event: ChatEvent) => void) | null = null;
vi.mock('../hooks/useChatStream', () => ({
  useChatStream: ({ onEvent }: { onEvent: (event: ChatEvent) => void }) => {
    streamEvents = onEvent;
  }
}));

import ConversationsPage from './ConversationsPage';
import type { ChatEvent } from '../types';

const conversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  groupId: 'g1',
  title: '',
  members: [
    { userId: 'u-tom', email: 'tom@example.com', name: 'Tom', joinedAt: '' },
    { userId: 'u-irja', email: 'irja@example.com', name: 'Irja', joinedAt: '' }
  ],
  lastMessageAt: null,
  lastMessagePreview: '',
  lastMessageSender: '',
  unreadCount: 0,
  createdAt: '2026-09-21T10:00:00.000Z',
  ...overrides
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ConversationsPage currentUserId="u-tom" />
    </MemoryRouter>
  );

/**
 * Each test sets its own resolved value.
 *
 * A `mockResolvedValue` in `beforeEach` that a test later replaces with
 * `mockImplementation` makes vitest report the replacement's rejection as
 * unhandled, even though the component catches it. Setting one implementation
 * per test avoids the interaction entirely.
 */
beforeEach(() => ensureMyConversations.mockReset());
afterEach(() => vi.clearAllMocks());

describe('opening chat', () => {
  it('creates the conversation rather than listing an empty screen', async () => {
    // A group made in Groups has no conversation until something creates one.
    ensureMyConversations.mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(ensureMyConversations).toHaveBeenCalled());
  });

  it('shows the list even when there is only one conversation', async () => {
    ensureMyConversations.mockResolvedValue([conversation()]);

    renderPage();

    // The header's Chat button promises the list, and it is the way back out
    // of a thread; skipping it made a thread impossible to leave.
    await waitFor(() => expect(screen.getByText('Irja')).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens a thread when one is tapped', async () => {
    ensureMyConversations.mockResolvedValue([conversation(), conversation({ id: 'c2', title: 'Plans' })]);

    renderPage();
    await userEvent.click(await screen.findByText('Plans'));

    expect(navigate).toHaveBeenCalledWith('/chat/c2');
  });

  it('tells a direct message from a group chat', async () => {
    ensureMyConversations.mockResolvedValue([
      conversation(),
      conversation({
        id: 'c2',
        title: 'Family',
        members: [
          { userId: 'u-tom', email: 'tom@example.com', name: 'Tom', joinedAt: '' },
          { userId: 'u-irja', email: 'irja@example.com', name: 'Irja', joinedAt: '' },
          { userId: 'u-mia', email: 'mia@example.com', name: 'Mia', joinedAt: '' }
        ]
      })
    ]);

    renderPage();

    expect(await screen.findByText('Direct message')).toBeInTheDocument();
    expect(screen.getByText('Group chat · 3 people')).toBeInTheDocument();
  });

  it('names an untitled conversation after the other person', async () => {
    ensureMyConversations.mockResolvedValue([conversation(), conversation({ id: 'c2' })]);

    renderPage();

    await waitFor(() => expect(screen.getAllByText('Irja')[0]).toBeInTheDocument());
  });

  it('offers a way to set up a group when there is none', async () => {
    ensureMyConversations.mockResolvedValue([]);

    renderPage();

    // A link, rather than a sentence telling someone to go and find it.
    const link = await screen.findByRole('link', { name: /Set up a group/ });
    expect(link).toHaveAttribute('href', '/groups');
  });

  it('shows an unread count', async () => {
    ensureMyConversations.mockResolvedValue([
      conversation({ unreadCount: 3, lastMessagePreview: 'hei' }),
      conversation({ id: 'c2', title: 'Plans' })
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByLabelText('3 unread')).toBeInTheDocument());
  });

  it('says so when a conversation has no messages yet', async () => {
    ensureMyConversations.mockResolvedValue([conversation(), conversation({ id: 'c2', title: 'Plans' })]);

    renderPage();

    await waitFor(() => expect(screen.getAllByText('No messages yet')[0]).toBeInTheDocument());
  });
});

describe('live', () => {
  const play = (event: Omit<ChatEvent, 'at'>) => act(() => streamEvents!({ at: Date.now(), ...event }));
  const message = (overrides: Record<string, unknown> = {}) => ({
    id: 'm9',
    conversationId: 'c1',
    senderId: 'u-irja',
    senderEmail: 'irja@example.com',
    senderName: 'Irja',
    kind: 'text',
    body: 'on my way',
    attachments: [],
    replyTo: null,
    reactions: [],
    clientId: 'x',
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-09-22T12:00:00.000Z',
    ...overrides
  });

  it('shows a new message as the preview and counts it unread', async () => {
    ensureMyConversations.mockResolvedValue([conversation()]);
    renderPage();
    await screen.findByText('Irja');

    play({ type: 'message.created', conversationId: 'c1', payload: message() });

    expect(screen.getByText('on my way')).toBeInTheDocument();
    expect(screen.getByLabelText('1 unread')).toBeInTheDocument();
  });

  it('previews a collage card by its name, as the server does', async () => {
    ensureMyConversations.mockResolvedValue([conversation()]);
    renderPage();
    await screen.findByText('Irja');

    play({
      type: 'message.created',
      conversationId: 'c1',
      payload: { ...message(), kind: 'collage', body: '', collage: { id: 'k1', title: 'Rome' } }
    });

    expect(screen.getByText('Collage: Rome')).toBeInTheDocument();
  });

  it('shows typing in place of the preview, and drops it when the message lands', async () => {
    ensureMyConversations.mockResolvedValue([conversation({ lastMessagePreview: 'hei' })]);
    renderPage();
    await screen.findByText('hei');

    play({ type: 'typing', conversationId: 'c1', payload: { userId: 'u-irja', name: 'Irja' } });
    expect(screen.getByText('typing…')).toBeInTheDocument();
    expect(screen.queryByText('hei')).not.toBeInTheDocument();

    play({ type: 'message.created', conversationId: 'c1', payload: message() });
    expect(screen.queryByText('typing…')).not.toBeInTheDocument();
    expect(screen.getByText('on my way')).toBeInTheDocument();
  });

  it('lights the dot when the other person comes online', async () => {
    ensureMyConversations.mockResolvedValue([conversation({ presence: [] })]);
    const { container } = renderPage();
    await screen.findByText('Irja');
    expect(container.querySelector('.MuiBadge-dot')).toHaveClass('MuiBadge-invisible');

    play({
      type: 'presence',
      conversationId: '',
      payload: { userId: 'u-irja', online: true, lastActiveAt: '2026-09-22T12:00:00.000Z' }
    });

    expect(container.querySelector('.MuiBadge-dot')).not.toHaveClass('MuiBadge-invisible');
  });
});
