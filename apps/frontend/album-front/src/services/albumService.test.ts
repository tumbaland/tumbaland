import { vi } from 'vite-plus/test';
import { albumService } from './albumService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  } as Response);
}

describe('albumService', () => {
  it('fetches paginated albums and unwraps the envelope', async () => {
    mockFetchOnce({
      success: true,
      data: { albums: [{ _id: 'album-1', name: 'Trip' }], pagination: { page: 1, limit: 10, total: 1, pages: 1 } }
    });

    const result = await albumService.getAlbums({ page: 1, limit: 10 });

    expect(result).toEqual({
      albums: [{ _id: 'album-1', name: 'Trip' }],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 }
    });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/albums?page=1&limit=10');
  });

  it('reads every page of albums for a picker, so older albums can be chosen too', async () => {
    const newest = Array.from({ length: 100 }, (_, index) => ({ _id: `a${index}` }));
    mockFetchOnce({
      success: true,
      data: { albums: newest, pagination: { page: 1, limit: 100, total: 101, pages: 2 } }
    });
    mockFetchOnce({
      success: true,
      data: { albums: [{ _id: 'oldest' }], pagination: { page: 2, limit: 100, total: 101, pages: 2 } }
    });

    const albums = await albumService.getAllAlbums({ includeCover: false });

    expect(albums).toHaveLength(101);
    expect(albums[100]).toEqual({ _id: 'oldest' });
    const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => String(url));
    expect(urls[0]).toContain('page=1&limit=100');
    expect(urls[1]).toContain('page=2&limit=100');
  });

  it('creates an album and returns the full envelope', async () => {
    mockFetchOnce({ success: true, message: 'Album created', data: { _id: 'album-2', name: 'New album' } });

    const result = await albumService.createAlbum({ name: 'New album' });

    expect(result).toEqual({ success: true, message: 'Album created', data: { _id: 'album-2', name: 'New album' } });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ name: 'New album' }) });
  });

  it('propagates a non-ok response as a thrown ApiError', async () => {
    mockFetchOnce({ success: false, message: 'Album not found' }, { ok: false, status: 404 });

    await expect(albumService.getAlbumById('missing-id')).rejects.toMatchObject({
      status: 404,
      message: 'Album not found'
    });
  });

  it('updates an album and returns the full envelope', async () => {
    mockFetchOnce({ success: true, data: { _id: 'album-1', name: 'Renamed' } });

    const result = await albumService.updateAlbum('album-1', { name: 'Renamed' });

    expect(result).toEqual({ success: true, data: { _id: 'album-1', name: 'Renamed' } });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/albums/album-1');
    expect(init).toMatchObject({ method: 'PUT' });
  });

  it('deletes an album and returns the full envelope', async () => {
    mockFetchOnce({ success: true });

    const result = await albumService.deleteAlbum('album-1');

    expect(result).toEqual({ success: true });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/albums/album-1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('sets the cover photo for an album', async () => {
    mockFetchOnce({ success: true, data: { _id: 'album-1', coverPhotoId: 'photo-1' } });

    await albumService.setCoverPhoto('album-1', 'photo-1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/albums/album-1/cover');
    expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify({ photoId: 'photo-1' }) });
  });

  it('removes the cover photo from an album', async () => {
    mockFetchOnce({ success: true, data: { _id: 'album-1', coverPhotoId: undefined } });

    await albumService.removeCoverPhoto('album-1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/albums/album-1/cover');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('fetches album statistics for the dashboard', async () => {
    mockFetchOnce({ success: true, data: { overview: { totalAlbums: 3 } } });

    const result = await albumService.getAlbumStatistics({ groupId: 'group-1' });

    expect(result).toEqual({ overview: { totalAlbums: 3 } });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/statistics?groupId=group-1');
  });
});
