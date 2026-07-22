import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/albumService', () => ({
  albumService: {
    getAlbums: vi.fn(),
    createAlbum: vi.fn(),
    updateAlbum: vi.fn(),
    deleteAlbum: vi.fn()
  }
}));

import { albumService } from '../services/albumService';
import { useAlbums } from './useAlbums';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient
  };
}

beforeEach(() => vi.clearAllMocks());

it('fetches albums, normalizing away undefined params', async () => {
  (albumService.getAlbums as ReturnType<typeof vi.fn>).mockResolvedValue({
    albums: [{ _id: 'album-1' }],
    pagination: { page: 1, limit: 10, total: 1, pages: 1 }
  });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAlbums({ page: 1, limit: 10, search: undefined }), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.albums).toEqual([{ _id: 'album-1' }]);
  expect(result.current.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  expect(albumService.getAlbums).toHaveBeenCalledWith({ page: 1, limit: 10 });
});

it('falls back to page 1 / limit 10 pagination when the query has no data yet', async () => {
  (albumService.getAlbums as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });

  expect(result.current.pagination).toEqual({ page: 1, limit: 10, total: 0, pages: 0 });
  expect(result.current.loading).toBe(true);
});

it('surfaces a query error as a string message', async () => {
  (albumService.getAlbums as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.error).toBe('network down'));
});

it('creates an album and invalidates the albums list', async () => {
  (albumService.createAlbum as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { _id: 'album-2' } });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });
  await result.current.createAlbum({ name: 'New album' });

  expect(albumService.createAlbum).toHaveBeenCalledWith({ name: 'New album' });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['albums'] });
});

it('updates an album and invalidates both the list and the single-album query', async () => {
  (albumService.updateAlbum as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: { _id: 'album-1' } });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });
  await result.current.updateAlbum('album-1', { name: 'Renamed' });

  expect(albumService.updateAlbum).toHaveBeenCalledWith('album-1', { name: 'Renamed' });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['albums'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['album', 'album-1'] });
});

it('deletes an album and invalidates the albums list', async () => {
  (albumService.deleteAlbum as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useAlbums(), { wrapper: Wrapper });
  await result.current.deleteAlbum('album-1');

  expect(albumService.deleteAlbum).toHaveBeenCalledWith('album-1');
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['albums'] });
});
