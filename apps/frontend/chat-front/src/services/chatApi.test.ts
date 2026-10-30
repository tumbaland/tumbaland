import { vi } from 'vite-plus/test';

const mockedGetGlobalConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => mockedGetGlobalConfig()
}));

import { chatApi, newClientId } from './chatApi';
import type { Attachment } from '../types';

const BASE = 'https://chat.example';

/** What the service answered with. A bare `undefined` is an empty 200, as a delete gets. */
const reply = (body?: unknown, status = 200) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body))
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** The request that went out, as the pieces a test wants to assert on. */
const sent = (fetchMock: ReturnType<typeof vi.fn>, call = 0) => {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit | undefined];
  const parsed = new URL(url);
  return {
    path: parsed.pathname,
    query: Object.fromEntries(parsed.searchParams),
    method: init?.method ?? 'GET',
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  };
};

beforeEach(() => {
  mockedGetGlobalConfig.mockReturnValue({ CHAT_API_URL: BASE, AUTH_FRONT_URL: 'https://login.example' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('newClientId', () => {
  it('uses a random UUID where the browser offers one', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });

    expect(newClientId()).toBe('uuid-1');
  });

  it('still makes a unique-looking id on a plain-HTTP dev origin', () => {
    vi.stubGlobal('crypto', {});

    const first = newClientId();
    const second = newClientId();

    expect(first).toMatch(/^c-\d+-[a-z0-9]+$/);
    expect(second).not.toBe(first);
  });
});

describe('conversations', () => {
  it('lists them, and none when the service says nothing', async () => {
    const fetchMock = reply({ data: [{ id: 'c1' }] });
    await expect(chatApi.listConversations()).resolves.toEqual([{ id: 'c1' }]);
    expect(sent(fetchMock)).toMatchObject({ path: '/api/chat/conversations', method: 'GET' });

    reply(null);
    await expect(chatApi.listConversations()).resolves.toEqual([]);
  });

  it('opens with the caller’s own conversations, created where missing', async () => {
    const fetchMock = reply({ data: [{ id: 'c1' }] });
    await expect(chatApi.ensureMyConversations()).resolves.toEqual([{ id: 'c1' }]);
    expect(sent(fetchMock)).toMatchObject({ path: '/api/chat/conversations/mine', method: 'POST' });

    reply(null);
    await expect(chatApi.ensureMyConversations()).resolves.toEqual([]);
  });

  it('makes sure a group has its conversation', async () => {
    const fetchMock = reply({ data: { id: 'c1' } });

    await expect(chatApi.ensureConversation('g1', 'Us')).resolves.toEqual({ id: 'c1' });

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations',
      method: 'POST',
      body: { groupId: 'g1', title: 'Us' }
    });
  });

  it('reads one conversation with its members', async () => {
    const fetchMock = reply({ data: { id: 'c1', members: [] } });

    await expect(chatApi.getConversation('c1')).resolves.toEqual({ id: 'c1', members: [] });

    expect(sent(fetchMock).path).toBe('/api/chat/conversations/c1');
  });

  it('counts unread messages, as none when the service says nothing', async () => {
    const fetchMock = reply({ data: { unread: 4 } });
    await expect(chatApi.unreadCount()).resolves.toBe(4);
    expect(sent(fetchMock).path).toBe('/api/chat/unread');

    reply(null);
    await expect(chatApi.unreadCount()).resolves.toBe(0);
  });
});

describe('messages', () => {
  it('pages through them with a cursor', async () => {
    const page = { messages: [{ id: 'm1' }], nextCursor: 'm0' };
    const fetchMock = reply({ data: page });

    await expect(chatApi.listMessages('c/1', { before: 'm5', limit: 30 })).resolves.toEqual(page);

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c%2F1/messages',
      query: { before: 'm5', limit: '30' }
    });
  });

  it('gives an empty page when the service says nothing', async () => {
    reply(null);

    await expect(chatApi.listMessages('c1')).resolves.toEqual({ messages: [], nextCursor: null });
  });

  it('sends a message with only what the service needs to know about each attachment', async () => {
    const fetchMock = reply({ data: { id: 'm1' } });
    const attachment = {
      fileId: 'f1',
      mimetype: 'image/jpeg',
      sizeBytes: 10,
      name: 'beach.jpg',
      posterFileId: 'poster',
      thumbnailFileId: 'thumb',
      width: 800,
      height: 600,
      durationMs: 1200,
      url: 'https://cdn.example/f1',
      extra: 'not sent'
    } as unknown as Attachment;

    await expect(
      chatApi.sendMessage('c1', { clientId: 'k1', body: 'hi', attachments: [attachment], replyTo: 'm0' })
    ).resolves.toEqual({ id: 'm1' });

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/messages',
      method: 'POST',
      body: {
        clientId: 'k1',
        body: 'hi',
        replyTo: 'm0',
        attachments: [
          {
            fileId: 'f1',
            mimetype: 'image/jpeg',
            sizeBytes: 10,
            name: 'beach.jpg',
            posterFileId: 'poster',
            thumbnailFileId: 'thumb',
            width: 800,
            height: 600,
            durationMs: 1200
          }
        ]
      }
    });
    expect(sent(fetchMock).body.attachments[0]).not.toHaveProperty('extra');
    expect(sent(fetchMock).body.attachments[0]).not.toHaveProperty('url');
  });

  it('leaves out what an attachment does not have', async () => {
    const fetchMock = reply({ data: { id: 'm1' } });

    await chatApi.sendMessage('c1', {
      clientId: 'k1',
      attachments: [{ fileId: 'f1', mimetype: 'application/pdf', sizeBytes: 5 } as Attachment]
    });

    expect(sent(fetchMock).body.attachments).toEqual([{ fileId: 'f1', mimetype: 'application/pdf', sizeBytes: 5 }]);
  });

  it('starts a collage together', async () => {
    const fetchMock = reply({ data: { id: 'm1' } });

    await chatApi.startCollage('c1', { clientId: 'k1', title: 'Trip' });

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/collages',
      method: 'POST',
      body: { clientId: 'k1', title: 'Trip' }
    });
  });

  it('edits a message', async () => {
    const fetchMock = reply({ data: { id: 'm1', body: 'new' } });

    await expect(chatApi.editMessage('c1', 'm1', 'new')).resolves.toEqual({ id: 'm1', body: 'new' });

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/messages/m1',
      method: 'PATCH',
      body: { body: 'new' }
    });
  });

  it('deletes a message', async () => {
    const fetchMock = reply();

    await expect(chatApi.deleteMessage('c1', 'm 1')).resolves.toBeUndefined();

    expect(sent(fetchMock)).toMatchObject({ path: '/api/chat/conversations/c1/messages/m%201', method: 'DELETE' });
  });

  it('toggles a reaction', async () => {
    const fetchMock = reply({ data: { id: 'm1' } });

    await chatApi.toggleReaction('c1', 'm1', '❤️');

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/messages/m1/reactions',
      method: 'PUT',
      body: { emoji: '❤️' }
    });
  });

  it('marks a conversation read up to a message', async () => {
    const fetchMock = reply();

    await chatApi.markRead('c1', 'm9');

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/read',
      method: 'POST',
      body: { lastReadMessageId: 'm9' }
    });
  });

  it('searches one conversation or all of them, finding nothing when the service says nothing', async () => {
    const fetchMock = reply({ data: [{ id: 'm1' }] });
    await expect(chatApi.search('beach', 'c1')).resolves.toEqual([{ id: 'm1' }]);
    expect(sent(fetchMock)).toMatchObject({ path: '/api/chat/search', query: { q: 'beach', conversationId: 'c1' } });

    reply(null);
    await expect(chatApi.search('beach')).resolves.toEqual([]);
  });
});

describe('typing notices', () => {
  it('tells the service someone is typing', async () => {
    const fetchMock = reply();

    await chatApi.sendTyping('c1');

    expect(sent(fetchMock)).toMatchObject({ path: '/api/chat/conversations/c1/typing', method: 'POST' });
  });

  it('never fails the caller, however the notice goes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(chatApi.sendTyping('c1')).resolves.toBeUndefined();
  });
});

describe('appearance and albums', () => {
  it('changes the theme or background for everyone', async () => {
    const fetchMock = reply({ data: { theme: 'sunset', backgroundFileId: null } });

    await chatApi.setAppearance('c1', { theme: 'sunset', backgroundFileId: null });

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/appearance',
      method: 'PUT',
      body: { theme: 'sunset', backgroundFileId: null }
    });
  });

  it('lists the group’s albums, none when the service says nothing', async () => {
    const fetchMock = reply({ data: [{ id: 'a1' }] });
    await expect(chatApi.listAlbums('c1')).resolves.toEqual([{ id: 'a1' }]);
    expect(sent(fetchMock).path).toBe('/api/chat/conversations/c1/albums');

    reply(null);
    await expect(chatApi.listAlbums('c1')).resolves.toEqual([]);
  });

  it('chooses where the conversation’s photos go', async () => {
    const fetchMock = reply({ data: { albumId: 'a1' } });

    await chatApi.setPhotoAlbum('c1', { albumId: 'a1' } as never);

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/photo-album',
      method: 'PUT',
      body: { albumId: 'a1' }
    });
  });

  it('takes a whole message, or some files of it, out of its album', async () => {
    const fetchMock = reply({ data: { id: 'm1' } });

    await chatApi.removeFromAlbum('c1', 'm1');
    await chatApi.removeFromAlbum('c1', 'm1', ['f 1', 'f2']);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/chat/conversations/c1/messages/m1/album`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/api/chat/conversations/c1/messages/m1/album?fileId=f%201&fileId=f2`);
    expect(sent(fetchMock).method).toBe('DELETE');
  });

  it('puts a message’s files, or some of them, in another album', async () => {
    const fetchMock = reply({ data: { id: 'm1' } });

    await chatApi.placeInAlbum('c1', 'm1', { albumId: 'a2' } as never);
    await chatApi.placeInAlbum('c1', 'm1', { albumId: 'a2' } as never, ['f1']);

    expect(sent(fetchMock, 0)).toMatchObject({
      path: '/api/chat/conversations/c1/messages/m1/album',
      method: 'PUT',
      body: { albumId: 'a2' }
    });
    expect(sent(fetchMock, 1).body).toEqual({ albumId: 'a2', fileIds: ['f1'] });
  });
});

describe('attachments', () => {
  it('asks for a place to upload a file', async () => {
    const ticket = { uploadUrl: 'https://upload.example', fileId: 'f1' };
    const fetchMock = reply({ data: ticket });

    await expect(
      chatApi.attachmentUploadUrl('c1', { filename: 'a.jpg', mimetype: 'image/jpeg', sizeBytes: 9 })
    ).resolves.toEqual(ticket);

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/attachments/upload-url',
      method: 'POST',
      body: { filename: 'a.jpg', mimetype: 'image/jpeg', sizeBytes: 9 }
    });
  });

  it('asks for a display copy, and goes without one rather than block the send', async () => {
    const fetchMock = reply({ data: { thumbnailFileId: 't1' } });
    await expect(chatApi.requestThumbnail('c1', 'f1', 'image/jpeg')).resolves.toBe('t1');
    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/attachments/thumbnail',
      body: { fileId: 'f1', mimetype: 'image/jpeg' }
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(chatApi.requestThumbnail('c1', 'f1', 'image/jpeg')).resolves.toBeNull();
  });
});

describe('calls', () => {
  it('fetches fresh relay servers', async () => {
    const fetchMock = reply({ data: { iceServers: [] } });

    await expect(chatApi.iceServers()).resolves.toEqual({ iceServers: [] });

    expect(sent(fetchMock).path).toBe('/api/chat/calls/ice-servers');
  });

  it('knows the call in progress, if any', async () => {
    const fetchMock = reply({ data: { id: 'call1' } });
    await expect(chatApi.currentCall()).resolves.toEqual({ id: 'call1' });
    expect(sent(fetchMock).path).toBe('/api/chat/calls/current');

    reply({ data: null });
    await expect(chatApi.currentCall()).resolves.toBeNull();

    reply(null);
    await expect(chatApi.currentCall()).resolves.toBeNull();
  });

  it('starts, accepts, declines and ends a call', async () => {
    const fetchMock = reply({ data: { id: 'call1' } });

    await expect(chatApi.startCall('c1', 'd1')).resolves.toEqual({ id: 'call1' });
    await expect(chatApi.acceptCall('call 1', 'd2')).resolves.toEqual({ id: 'call1' });
    await chatApi.declineCall('call1');
    await chatApi.endCall('call1');

    expect(sent(fetchMock, 0)).toMatchObject({
      path: '/api/chat/conversations/c1/calls',
      method: 'POST',
      body: { deviceId: 'd1' }
    });
    expect(sent(fetchMock, 1)).toMatchObject({ path: '/api/chat/calls/call%201/accept', body: { deviceId: 'd2' } });
    expect(sent(fetchMock, 2).path).toBe('/api/chat/calls/call1/decline');
    expect(sent(fetchMock, 3).path).toBe('/api/chat/calls/call1/end');
  });

  it('passes a signal on to the other device', async () => {
    const fetchMock = reply();
    const data = { type: 'offer', sdp: 'v=0' } as never;

    await chatApi.sendSignal('call1', 'd1', data);

    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/calls/call1/signal',
      method: 'POST',
      body: { deviceId: 'd1', data }
    });
  });
});

it('names the address the live stream opens, on the chat service’s own origin', () => {
  expect(chatApi.streamUrl()).toBe(`${BASE}/api/chat/stream`);
});

it('sends someone whose session ended to sign in, and back again', async () => {
  const href = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return 'https://app.example/chat';
      },
      set href(value: string) {
        href(value);
      }
    }
  });
  reply({ message: 'Unauthorized' }, 401);

  await expect(chatApi.listConversations()).rejects.toBeDefined();

  expect(href).toHaveBeenCalledWith(
    `https://login.example?redirect_uri=${encodeURIComponent('https://app.example/chat')}`
  );
  Object.defineProperty(window, 'location', { configurable: true, value: original });
});

describe('sharing where one is, live', () => {
  it('lists, starts, sends, and stops a share', async () => {
    const fetchMock = reply({ data: [] });

    await chatApi.listLive('c1');
    await chatApi.startLive('c1', { destination: { lat: 59.4, lng: 24.7 } });
    await chatApi.sendLivePosition('c1', { lat: 59.4, lng: 24.7, accuracy: 8 });
    await chatApi.stopLive('c1');

    expect(sent(fetchMock, 0)).toMatchObject({ path: '/api/chat/conversations/c1/live', method: 'GET' });
    expect(sent(fetchMock, 1)).toMatchObject({
      path: '/api/chat/conversations/c1/live',
      method: 'PUT',
      body: { destination: { lat: 59.4, lng: 24.7 } }
    });
    expect(sent(fetchMock, 2)).toMatchObject({
      path: '/api/chat/conversations/c1/live/position',
      method: 'POST',
      body: { lat: 59.4, lng: 24.7, accuracy: 8 }
    });
    expect(sent(fetchMock, 3)).toMatchObject({ path: '/api/chat/conversations/c1/live', method: 'DELETE' });
  });

  it('asks to be told when someone is close, and stops asking', async () => {
    const fetchMock = reply({ data: { userId: 'u-tom' } });

    await chatApi.watchLive('c1', 'u-tom', { lat: 59.4, lng: 24.7, radiusM: 1000 });
    await chatApi.unwatchLive('c1', 'u-tom');

    expect(sent(fetchMock, 0)).toMatchObject({
      path: '/api/chat/conversations/c1/live/u-tom/watch',
      method: 'PUT',
      body: { lat: 59.4, lng: 24.7, radiusM: 1000 }
    });
    expect(sent(fetchMock, 1)).toMatchObject({ path: '/api/chat/conversations/c1/live/u-tom/watch', method: 'DELETE' });
  });
});

describe('places', () => {
  it('searches near a point, and finds the address at one', async () => {
    const fetchMock = reply({ data: [] });

    await chatApi.searchPlaces('kalev spa', { lat: 59.4, lng: 24.7 });
    await chatApi.searchPlaces('kalev');
    await chatApi.placeAt(59.43, 24.76);

    expect(sent(fetchMock, 0)).toMatchObject({ path: '/api/chat/places/search', method: 'GET' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/chat/places/search?q=kalev+spa&lat=59.4&lng=24.7`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/api/chat/places/search?q=kalev`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${BASE}/api/chat/places/reverse?lat=59.43&lng=24.76`);
  });

  it('lists, saves and deletes the group\u2019s places', async () => {
    const fetchMock = reply({ data: [] });

    await chatApi.listSavedPlaces('c1');
    await chatApi.savePlace('c1', { name: 'Home', lat: 59.5, lng: 24.8, address: 'Viru 4' });
    await chatApi.deleteSavedPlace('c1', 'p-home');

    expect(sent(fetchMock, 0)).toMatchObject({ path: '/api/chat/conversations/c1/places', method: 'GET' });
    expect(sent(fetchMock, 1)).toMatchObject({
      path: '/api/chat/conversations/c1/places',
      method: 'POST',
      body: { name: 'Home', lat: 59.5, lng: 24.8, address: 'Viru 4' }
    });
    expect(sent(fetchMock, 2)).toMatchObject({ path: '/api/chat/conversations/c1/places/p-home', method: 'DELETE' });
  });
});

describe('assistants', () => {
  const view = { enabled: true };

  it('reads the conversation\u2019s assistants', async () => {
    const fetchMock = reply({ data: view });
    expect(await chatApi.getAssistants('c 1')).toEqual(view);
    expect(sent(fetchMock)).toMatchObject({ path: '/api/chat/conversations/c%201/assistants', method: 'GET' });
  });

  it('changes the settings, and answers with the new view', async () => {
    const fetchMock = reply({ data: view });
    await chatApi.changeAssistants('c1', { enabled: true, aboutUs: 'We live in Tallinn.' });
    expect(sent(fetchMock)).toMatchObject({
      path: '/api/chat/conversations/c1/assistants',
      method: 'PATCH',
      body: { enabled: true, aboutUs: 'We live in Tallinn.' }
    });
  });

  it('adds, changes and removes a bot', async () => {
    const fetchMock = reply({ data: view });
    await chatApi.createBot('c1', { name: 'Tumbi' });
    await chatApi.updateBot('c1', 'b/1', { paused: true });
    await chatApi.deleteBot('c1', 'b/1');
    expect(sent(fetchMock, 0)).toMatchObject({ path: '/api/chat/conversations/c1/assistants/bots', method: 'POST', body: { name: 'Tumbi' } });
    expect(sent(fetchMock, 1)).toMatchObject({ path: '/api/chat/conversations/c1/assistants/bots/b%2F1', method: 'PATCH', body: { paused: true } });
    expect(sent(fetchMock, 2)).toMatchObject({ path: '/api/chat/conversations/c1/assistants/bots/b%2F1', method: 'DELETE' });
  });

  it('reads the allowance, and sets or clears a cap', async () => {
    const fetchMock = reply({ data: { used: 1 } });
    expect(await chatApi.getAllowance()).toEqual({ used: 1 });
    await chatApi.setAllowanceCap(50);
    await chatApi.setAllowanceCap(null);
    expect(sent(fetchMock, 0)).toMatchObject({ path: '/api/chat/assistants/me', method: 'GET' });
    expect(sent(fetchMock, 1)).toMatchObject({ path: '/api/chat/assistants/me', method: 'PUT', body: { capPercent: 50 } });
    expect(sent(fetchMock, 2).body).toEqual({ capPercent: null });
  });
});
