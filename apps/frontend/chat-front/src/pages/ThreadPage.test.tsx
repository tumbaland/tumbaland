import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ChatEvent, ConversationDetail, Message } from '../types';
import type { UseChatStreamOptions } from '../hooks/useChatStream';

const api = vi.hoisted(() => ({
  getConversation: vi.fn(),
  listMessages: vi.fn(),
  listLive: vi.fn(),
  markRead: vi.fn(),
  sendTyping: vi.fn(),
  listSavedPlaces: vi.fn(),
  placeAt: vi.fn(),
  sendMessage: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  listAlbums: vi.fn(),
  placeInAlbum: vi.fn(),
  search: vi.fn(),
  setAppearance: vi.fn()
}));
const transport = vi.hoisted(() => ({ current: null as UseChatStreamOptions | null }));
const inbox = vi.hoisted(() => ({ readShare: vi.fn(), clearShare: vi.fn() }));

vi.mock('../services/chatApi', () => ({ chatApi: api, newClientId: () => 'new-message' }));
vi.mock('../services/sharedInbox', async (original) => ({
  ...(await original<typeof import('../services/sharedInbox')>()),
  ...inbox
}));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u-tom', name: 'Tom', email: 'tom@example.com' }, loading: false })
}));
vi.mock('../hooks/useChatStream', () => ({
  useChatStream: (options: UseChatStreamOptions) => {
    transport.current = options;
  }
}));
vi.mock('../services/live', async (original) => ({
  ...(await original<typeof import('../services/live')>()),
  isGeolocationSupported: () => true,
  currentPosition: async () => ({ coords: { latitude: 59.437, longitude: 24.7536, accuracy: 10 } })
}));
// Leaflet needs browser layout. Keep the real dialog and thread composition.
vi.mock('../components/live/LiveMap', () => ({ default: () => <div data-testid="location-map" /> }));

import ThreadPage from './ThreadPage';

const message = (id: string, conversationId = 'c1'): Message => ({
  id,
  conversationId,
  senderId: 'u-irja',
  senderEmail: 'irja@example.com',
  senderName: 'Irja',
  kind: 'text',
  body: `Message ${id}`,
  attachments: [],
  replyTo: null,
  reactions: [],
  clientId: id,
  editedAt: null,
  deletedAt: null,
  createdAt: new Date().toISOString()
});

const detail = (id: string): ConversationDetail => ({
  id,
  groupId: 'g1',
  title: 'Family',
  members: [
    { userId: 'u-tom', name: 'Tom', email: 'tom@example.com', joinedAt: new Date().toISOString() },
    { userId: 'u-irja', name: 'Irja', email: 'irja@example.com', joinedAt: new Date().toISOString() }
  ],
  reads: [],
  presence: [],
  photoAlbum: { mode: 'unset', albumId: null, albumName: null },
  appearance: { theme: 'default', backgroundFileId: null, backgroundUrl: null }
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getConversation.mockImplementation(async (id: string) => detail(id));
  api.listMessages.mockImplementation(async (id: string) => ({
    messages: [message(`${id}-first`, id)],
    nextCursor: null
  }));
  api.listLive.mockResolvedValue([]);
  api.markRead.mockResolvedValue(undefined);
  api.sendTyping.mockResolvedValue(undefined);
  api.listSavedPlaces.mockResolvedValue([]);
  api.placeAt.mockResolvedValue(null);
  inbox.readShare
    .mockReset()
    .mockResolvedValue({ title: '', text: '', url: 'https://example.com/shared', files: [], receivedAt: 1 });
  inbox.clearShare.mockReset().mockResolvedValue(undefined);
  api.search.mockResolvedValue([message('c1-first')]);
  api.setAppearance.mockImplementation(async (_id: string, change: { theme: string }) => ({
    ...detail('c1').appearance,
    ...change
  }));
  api.deleteMessage.mockResolvedValue(undefined);
  api.listAlbums.mockResolvedValue([{ id: 'album-trip', name: 'Trip', photoCount: 0 }]);
  api.sendMessage.mockImplementation(
    async (id: string, input: { body: string; clientId: string; replyTo?: string }) => ({
      ...message('sent', id),
      senderId: 'u-tom',
      body: input.body,
      clientId: input.clientId,
      replyTo: input.replyTo ?? null
    })
  );
  api.editMessage.mockImplementation(async (id: string, messageId: string, body: string) => ({
    ...message(messageId, id),
    senderId: 'u-tom',
    body,
    editedAt: new Date().toISOString()
  }));
});

describe('desktop thread composition', () => {
  const emit = (event: ChatEvent) => act(() => transport.current?.onEvent(event));
  const onlyComposer = () => {
    expect(screen.getAllByRole('textbox', { name: 'Message' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Send' })).toHaveLength(1);
  };

  it('keeps one composer and its draft through stream updates, reconnects and opening the map', async () => {
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    const input = await screen.findByRole('textbox', { name: 'Message' });
    await userEvent.type(input, 'Keep this draft');
    for (let index = 0; index < 4; index++) {
      emit({ type: 'message.created', conversationId: 'c1', at: Date.now(), payload: message(`received-${index}`) });
      onlyComposer();
      expect(input).toHaveValue('Keep this draft');
    }
    act(() => transport.current?.onStateChange?.('polling'));
    await act(async () => {
      transport.current?.onResync();
    });
    onlyComposer();
    expect(input).toHaveValue('Keep this draft');

    await userEvent.click(screen.getByRole('button', { name: 'Share location' }));
    expect(await screen.findByTestId('location-map')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(onlyComposer);
    expect(input).toHaveValue('Keep this draft');
  });

  it('starts with one empty composer when the side panel switches conversations', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    await userEvent.type(await screen.findByRole('textbox', { name: 'Message' }), 'Only for c1');
    rerender(
      <MemoryRouter>
        <ThreadPage conversationId="c2" />
      </MemoryRouter>
    );
    await screen.findByText('Message c2-first');
    onlyComposer();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  });

  it('ignores a late message response from the conversation that was left', async () => {
    let finish!: (page: { messages: Message[]; nextCursor: null }) => void;
    api.listMessages.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { rerender } = render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    await waitFor(() => expect(api.listMessages).toHaveBeenCalledWith('c1', { limit: 50 }));
    rerender(
      <MemoryRouter>
        <ThreadPage conversationId="c2" />
      </MemoryRouter>
    );
    await screen.findByText('Message c2-first');

    await act(async () => finish({ messages: [message('late-c1')], nextCursor: null }));

    expect(screen.getByText('Message c2-first')).toBeInTheDocument();
    expect(screen.queryByText('Message late-c1')).not.toBeInTheDocument();
    onlyComposer();
  });

  it('sends a reply to the selected message and clears the reply session', async () => {
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    await userEvent.hover(await screen.findByText('Message c1-first'));
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Replying to Irja')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'On my way');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ body: 'On my way', replyTo: 'c1-first' })
      )
    );
    expect(screen.queryByText('Replying to Irja')).not.toBeInTheDocument();
    onlyComposer();
  });

  it('edits an own message and restores the draft after saving', async () => {
    api.listMessages.mockResolvedValue({ messages: [{ ...message('own'), senderId: 'u-tom' }], nextCursor: null });
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    const input = await screen.findByRole('textbox', { name: 'Message' });
    await userEvent.type(input, 'Unsent draft');
    await userEvent.hover(screen.getByText('Message own'));
    await userEvent.click(screen.getByRole('button', { name: 'Message options' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(input).toHaveValue('Message own');
    await userEvent.clear(input);
    await userEvent.type(input, 'Corrected text');
    await userEvent.click(screen.getByRole('button', { name: 'Save edit' }));
    await waitFor(() => expect(input).toHaveValue('Unsent draft'));
    expect(api.editMessage).toHaveBeenCalledWith('c1', 'own', 'Corrected text');
    expect(screen.getByText('Corrected text')).toBeInTheDocument();
    onlyComposer();
  });

  it('requires confirmation before unsending a message', async () => {
    api.listMessages.mockResolvedValue({ messages: [{ ...message('own'), senderId: 'u-tom' }], nextCursor: null });
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    await userEvent.hover(await screen.findByText('Message own'));
    await userEvent.click(screen.getByRole('button', { name: 'Message options' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Unsend' }));
    const confirmation = await screen.findByRole('dialog', { name: 'Unsend this message?' });
    expect(api.deleteMessage).not.toHaveBeenCalled();
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Unsend' }));
    await waitFor(() => expect(api.deleteMessage).toHaveBeenCalledWith('c1', 'own'));
    await waitFor(() => expect(screen.queryByText('Message own')).not.toBeInTheDocument());
  });

  it('changes the album of the photo selected in the viewer', async () => {
    const photoMessage = {
      ...message('photos'),
      attachments: [
        { fileId: 'photo-1', mimetype: 'image/jpeg', sizeBytes: 100, url: '/photo-1.jpg' },
        { fileId: 'photo-2', mimetype: 'image/jpeg', sizeBytes: 100, url: '/photo-2.jpg' }
      ]
    };
    api.listMessages.mockResolvedValue({ messages: [photoMessage], nextCursor: null });
    api.placeInAlbum.mockResolvedValue(photoMessage);
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    const photos = await screen.findAllByRole('button', { name: 'Open photo' });
    await userEvent.click(photos[1]!);
    await userEvent.click(await screen.findByRole('button', { name: "Change this photo's album" }));
    await userEvent.click(await screen.findByRole('button', { name: /Trip/ }));
    await waitFor(() =>
      expect(api.placeInAlbum).toHaveBeenCalledWith('c1', 'photos', { albumId: 'album-trip' }, ['photo-2'])
    );
  });

  it('opens a search result without losing the composer draft', async () => {
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    const input = await screen.findByRole('textbox', { name: 'Message' });
    await userEvent.type(input, 'Draft during search');
    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Search messages' }));
    await userEvent.type(await screen.findByRole('textbox', { name: 'Search messages' }), 'first');
    const results = await screen.findByRole('list', { name: 'Search results' });
    await userEvent.click(within(results).getByRole('button'));
    await waitFor(onlyComposer);
    expect(api.search).toHaveBeenCalledWith('first', 'c1');
    expect(input).toHaveValue('Draft during search');
    await waitFor(() => expect(screen.queryByText('Finding the message…')).not.toBeInTheDocument());
  });

  it('saves conversation settings from the toolbar', async () => {
    render(
      <MemoryRouter>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    await screen.findByRole('textbox', { name: 'Message' });
    await userEvent.click(screen.getByRole('button', { name: 'Conversation options' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /^Theme/ }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Ocean' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'true'));
    expect(api.setAppearance).toHaveBeenCalledWith('c1', { theme: 'ocean' });
  });

  it('puts an incoming shared link in the routed conversation composer', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/c1?shared=1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ThreadPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('https://example.com/shared')
    );
    expect(inbox.clearShare).toHaveBeenCalledTimes(1);
  });

  it('leaves incoming shares for the routed page when the side panel is open', async () => {
    render(
      <MemoryRouter initialEntries={['/album?shared=1']}>
        <ThreadPage conversationId="c1" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('textbox', { name: 'Message' })).toHaveValue('');
    expect(inbox.readShare).not.toHaveBeenCalled();
    expect(inbox.clearShare).not.toHaveBeenCalled();
  });
});
