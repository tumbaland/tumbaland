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
vi.mock('../pages/ConversationsPage', () => ({
  default: ({ onOpen }: { onOpen: (id: string) => void }) => (
    <button type="button" onClick={() => onOpen('c2')}>
      open c2
    </button>
  )
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
