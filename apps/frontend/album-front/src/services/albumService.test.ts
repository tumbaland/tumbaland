import { vi } from 'vitest';
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

    expect(result).toEqual({ albums: [{ _id: 'album-1', name: 'Trip' }], pagination: { page: 1, limit: 10, total: 1, pages: 1 } });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/albums?page=1&limit=10');
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

    await expect(albumService.getAlbumById('missing-id')).rejects.toMatchObject({ status: 404, message: 'Album not found' });
  });
});
