import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

import ConversationsPage from './ConversationsPage';

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

  it('goes straight into the thread when there is only one', async () => {
    ensureMyConversations.mockResolvedValue([conversation()]);

    renderPage();

    // The list would be a screen that exists only to be tapped through, which
    // is the normal case for two people.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/chat/c1', { replace: true }));
  });

  it('shows the list when there is more than one', async () => {
    ensureMyConversations.mockResolvedValue([
      conversation(),
      conversation({ id: 'c2', title: 'Plans' })
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText('Plans')).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalled();
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

  it('reports a failure rather than sitting on a spinner', async () => {
    // Returning a rejected promise rather than mockRejectedValue or an async
    // throw: both of those are reported as an unhandled rejection even though
    // the component catches it, because the rejection exists before anything
    // is waiting on it.
    ensureMyConversations.mockImplementation(() =>
      Promise.reject(new Error('chat-service is unreachable'))
    );

    renderPage();

    expect(await screen.findByText(/unreachable/)).toBeInTheDocument();
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
