import { vi } from 'vite-plus/test';

const mockedGetGlobalConfig = vi.fn();
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => mockedGetGlobalConfig()
}));

import { listAlbums, listConversations } from './shareApi';

const respondWith = (body: unknown) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  }) as unknown as typeof fetch;
};

const calledUrl = () => String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetGlobalConfig.mockReturnValue({
    CHAT_API_URL: 'https://chat.example',
    ALBUM_API_URL: 'https://album.example'
  });
});

describe('listConversations', () => {
  it('asks the chat service for the person’s conversations', async () => {
    const conversations = [{ id: 'c1', title: 'Us', members: [] }];
    respondWith({ data: conversations });

    await expect(listConversations()).resolves.toEqual(conversations);

    expect(calledUrl()).toBe('https://chat.example/api/chat/conversations/mine');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('offers nothing when the response has no data', async () => {
    respondWith({});

    await expect(listConversations()).resolves.toEqual([]);
  });
});

describe('listAlbums', () => {
  it('lists up to 100 albums without covers, from the album service', async () => {
    const albums = [{ _id: 'a1', name: 'Trip', photoCount: 3 }];
    respondWith({ data: { albums } });

    await expect(listAlbums()).resolves.toEqual(albums);

    const url = new URL(calledUrl());
    expect(url.origin + url.pathname).toBe('https://album.example/api/albums');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('includeCover')).toBe('false');
    expect(url.searchParams.has('groupId')).toBe(false);
  });

  it('narrows to a group when one is given', async () => {
    respondWith({ data: { albums: [] } });

    await listAlbums('g1');

    expect(new URL(calledUrl()).searchParams.get('groupId')).toBe('g1');
  });

  it('offers nothing when the response has no albums', async () => {
    respondWith({ data: {} });

    await expect(listAlbums()).resolves.toEqual([]);
  });
});
