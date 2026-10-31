import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conversation } from '../types';

const ensureMyConversations = vi.fn();
vi.mock('../services/chatApi', () => ({ chatApi: { ensureMyConversations: () => ensureMyConversations() } }));
vi.mock('../config/ConfigProvider', () => ({
  ConfigProvider: ({ children }: { children: React.ReactNode }) => children
}));
vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u-tom' }, loading: false }) }));
vi.mock('../pages/ThreadPage', () => ({
  default: ({ conversationId, onBack }: { conversationId: string; onBack?: () => void }) => (
    <div>
      thread {conversationId}
      {onBack && (
        <button type="button" onClick={onBack}>
          Back to conversations
        </button>
      )}
    </div>
  )
}));
let listGivenToPage: unknown = null;
vi.mock('../pages/ConversationsPage', () => ({
  default: ({ onOpen, initial }: { onOpen: (id: string) => void; initial?: unknown }) => {
    listGivenToPage = initial;
    return (
      <button type="button" onClick={() => onOpen('c2')}>
        open c2
      </button>
    );
  }
}));

import ChatPanel from './ChatPanel';

const conversation = (id: string, name: string): Conversation => ({
  id,
  groupId: 'g1',
  title: '',
  members: [
    { userId: 'u-tom', email: 't@x', name: 'Tom', joinedAt: '' },
    { userId: `u-${id}`, email: 'o@x', name, joinedAt: '' }
  ],
  lastMessageAt: null,
  lastMessagePreview: '',
  lastMessageSender: '',
  unreadCount: 0,
  createdAt: ''
});

beforeEach(() => {
  localStorage.clear();
  ensureMyConversations.mockReset();
});

it('goes straight into the only conversation', async () => {
  ensureMyConversations.mockResolvedValue([conversation('c1', 'Irja')]);
  render(<ChatPanel />);

  expect(await screen.findByText('thread c1')).toBeInTheDocument();
  // Nowhere to go back to with one conversation.
  expect(screen.queryByRole('button', { name: 'Back to conversations' })).not.toBeInTheDocument();
});

it('starts on the list with several, opens one in place, and goes back', async () => {
  ensureMyConversations.mockResolvedValue([conversation('c1', 'Irja'), conversation('c2', 'Mari')]);
  render(<ChatPanel />);

  await userEvent.click(await screen.findByRole('button', { name: 'open c2' }));
  expect(screen.getByText('thread c2')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Back to conversations' }));
  expect(screen.getByRole('button', { name: 'open c2' })).toBeInTheDocument();
});

it('reopens on the conversation it was last showing', async () => {
  localStorage.setItem('tumbaland.chatPanel.conversation', 'c2');
  ensureMyConversations.mockResolvedValue([conversation('c1', 'Irja'), conversation('c2', 'Mari')]);
  render(<ChatPanel />);

  expect(await screen.findByText('thread c2')).toBeInTheDocument();
});

it('says when the chats cannot be loaded, and tries again on request', async () => {
  ensureMyConversations.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([conversation('c1', 'Irja')]);
  render(<ChatPanel />);

  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('thread c1')).toBeInTheDocument();
  expect(ensureMyConversations).toHaveBeenCalledTimes(2);
});

it('shows the conversation it was last in at once, without waiting for the list', async () => {
  localStorage.setItem('tumbaland.chatPanel.conversation', 'c2');
  // The list never arrives: the thread must not depend on it
  ensureMyConversations.mockReturnValue(new Promise(() => {}));
  render(<ChatPanel />);

  expect(screen.getByText('thread c2')).toBeInTheDocument();
});

it('offers the way back only once it knows there is somewhere to go', async () => {
  localStorage.setItem('tumbaland.chatPanel.conversation', 'c1');
  let resolveList: (list: Conversation[]) => void = () => {};
  ensureMyConversations.mockReturnValue(new Promise<Conversation[]>((resolve) => (resolveList = resolve)));
  render(<ChatPanel />);

  expect(screen.getByText('thread c1')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Back to conversations' })).not.toBeInTheDocument();

  resolveList([conversation('c1', 'Irja'), conversation('c2', 'Mari')]);

  expect(await screen.findByRole('button', { name: 'Back to conversations' })).toBeInTheDocument();
});

it('drops back to the list when the conversation it remembered is no longer there', async () => {
  localStorage.setItem('tumbaland.chatPanel.conversation', 'gone');
  ensureMyConversations.mockResolvedValue([conversation('c1', 'Irja'), conversation('c2', 'Mari')]);
  render(<ChatPanel />);

  expect(await screen.findByRole('button', { name: 'open c2' })).toBeInTheDocument();
  expect(screen.queryByText('thread gone')).not.toBeInTheDocument();
  expect(localStorage.getItem('tumbaland.chatPanel.conversation')).toBeNull();
});

it('goes into the only conversation when what it remembered is gone', async () => {
  localStorage.setItem('tumbaland.chatPanel.conversation', 'gone');
  ensureMyConversations.mockResolvedValue([conversation('c1', 'Irja')]);
  render(<ChatPanel />);

  expect(await screen.findByText('thread c1')).toBeInTheDocument();
});

it('keeps the thread it has open when the list cannot be loaded', async () => {
  localStorage.setItem('tumbaland.chatPanel.conversation', 'c1');
  ensureMyConversations.mockRejectedValue(new Error('offline'));
  render(<ChatPanel />);

  // let the failed request settle
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(screen.getByText('thread c1')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
});

it('hands the list it already fetched to the list page, so it is not asked for twice', async () => {
  ensureMyConversations.mockResolvedValue([conversation('c1', 'Irja'), conversation('c2', 'Mari')]);
  render(<ChatPanel />);

  await screen.findByRole('button', { name: 'open c2' });

  expect(listGivenToPage).toHaveLength(2);
  expect(ensureMyConversations).toHaveBeenCalledTimes(1);
});
