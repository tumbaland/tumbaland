jest.mock('@tumbaland/backend-core', () => ({
  requireEnv: (name: string) => process.env[name] ?? 'http://album-service:4002'
}));

import fixtures from './__fixtures__/album-api.json';
import { album, albumPageSchema, memoriesSchema, photoPageSchema, resolveAlbum, Album } from './album';
import { parseResponse, ShapeError } from './schemas';

const respond = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, data: body })
  } as Response);

const KEY = 'tmb_live_abcdef123456_secret';
const albums = fixtures.albums.albums as unknown as Album[];

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('the recorded responses parse', () => {
  it('accepts a real /albums page', () => {
    const page = parseResponse(albumPageSchema, '/albums', fixtures.albums);

    expect(page.albums[0]).toMatchObject({ name: expect.any(String), photoCount: expect.any(Number) });
    // The page shows two; the library holds forty-four.
    expect(page.pagination?.total).toBeGreaterThan(page.albums.length);
  });

  it('accepts a real photo page, where most fields are absent', () => {
    // A real library has almost no titles, descriptions or tags, so none of
    // them can be required.
    const page = parseResponse(photoPageSchema, '/photos/album/:id', fixtures.photos);

    expect(page.photos[0].title).toBeUndefined();
    expect(page.photos[0].tags).toEqual([]);
    expect(page.photos[0].metadata?.dateTaken).toEqual(expect.any(String));
  });

  it('accepts a real memories response, across albums', () => {
    const memories = parseResponse(memoriesSchema, '/photos/memories', fixtures.memories);

    const names = memories.years[0].photos.map((photo) => photo.albumName);
    expect(new Set(names).size).toBeGreaterThan(1);
  });
});

describe('the client against recorded responses', () => {
  it('does not ask for cover photos', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.albums));

    await album.listAlbums(KEY, {});

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.searchParams.get('includeCover')).toBe('false');
  });

  it('reads photos from the album path, which is the only way to reach them', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.photos));

    await album.listPhotos(KEY, 'a1', { search: 'ferris' });

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.pathname).toBe('/api/photos/album/a1');
    expect(url.searchParams.get('search')).toBe('ferris');
  });

  it('reads memories from the one endpoint that spans albums', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.memories));

    await album.getMemories(KEY, { windowDays: 7 });

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.pathname).toBe('/api/photos/memories');
    expect(url.searchParams.get('windowDays')).toBe('7');
  });

  it('puts tag changes to the bulk endpoint, not one photo at a time', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ matched: 2, modified: 2 }));

    await album.tagPhotos(KEY, { photoIds: ['p1', 'p2'], add: ['beach'] });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.pathname).toBe('/api/photos/tags');
    expect(init.method).toBe('PUT');
  });

  it('forwards the caller’s own credential', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.albums));

    await album.listAlbums(KEY, {});

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });
});

describe('the endpoints this client speaks to', () => {
  const requested = () => (global.fetch as jest.Mock).mock.calls[0][0] as URL;

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReturnValue(respond({}));
  });

  it('reads an album’s tag list from its own path', async () => {
    await album.albumTags(KEY, 'a1');
    expect(requested().pathname).toBe('/api/photos/album/a1/tags');
  });

  it('puts a title or description on one photo', async () => {
    await album.describePhoto(KEY, 'p1', { title: 'The ferris wheel' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.pathname).toBe('/api/photos/p1');
    expect((init as RequestInit).method).toBe('PUT');
  });

  it('reads library totals from /statistics', async () => {
    await album.getStatistics(KEY, 'g1');
    expect(requested().pathname).toBe('/api/statistics');
    expect(requested().searchParams.get('groupId')).toBe('g1');
  });
});

describe('resolveAlbum', () => {
  it('matches a name exactly, whatever the case', () => {
    expect(resolveAlbum(albums, 'finland 2025').name).toBe('Finland 2025');
  });

  it('matches a unique partial, since "Spain" should find "Spain 2024"', () => {
    expect(resolveAlbum(albums, 'Tartu').name).toBe('Tartu 2024');
  });

  it('prefers an exact match over a partial one', () => {
    const withBoth = [...albums, { ...albums[0], _id: 'x', name: 'Finland 2025 extras' }];
    expect(resolveAlbum(withBoth, 'Finland 2025')._id).toBe(albums[0]._id);
  });

  it('asks rather than guessing when a partial matches several', () => {
    expect(() => resolveAlbum(albums, '20')).toThrow(/more than one album/);
  });

  it('lists the real albums when there is no match', () => {
    // An error naming the options gets the next attempt right; "not found"
    // teaches nothing.
    expect(() => resolveAlbum(albums, 'Iceland')).toThrow(/Finland 2025, Tartu 2024/);
  });

  it('says so when there are no albums at all', () => {
    expect(() => resolveAlbum([], 'anything')).toThrow(/none yet/);
  });
});

describe('a changed contract fails loudly', () => {
  it('rejects a bare array where a page was returned', () => {
    expect(() => parseResponse(albumPageSchema, '/albums', [])).toThrow(ShapeError);
  });

  it('names the field that was wrong', () => {
    try {
      parseResponse(albumPageSchema, '/albums', { albums: [{ _id: 'a1' }] });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ShapeError).message).toContain('albums.0.name');
    }
  });

  it('reads a missing photo count as zero rather than failing', () => {
    // An album that predates the denormalised counter should still be listable.
    const legacy = { albums: [{ _id: 'a1', name: 'Old' }] };
    expect(parseResponse(albumPageSchema, '/albums', legacy).albums[0].photoCount).toBe(0);
  });
});
