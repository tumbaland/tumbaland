import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/photoService', () => ({
  photoService: {
    loadPhotosWithThumbnails: vi.fn(),
    updatePhoto: vi.fn(),
    deletePhoto: vi.fn()
  }
}));

import { photoService } from '../services/photoService';
import { usePhotos } from './usePhotos';

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

it('fetches photos for an album, normalizing away undefined params', async () => {
  (photoService.loadPhotosWithThumbnails as ReturnType<typeof vi.fn>).mockResolvedValue({
    photos: [{ _id: 'photo-1' }],
    pagination: { page: 1, limit: 20, total: 1, pages: 1 }
  });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => usePhotos('album-1', { page: 1, search: undefined }), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.photos).toEqual([{ _id: 'photo-1' }]);
  expect(photoService.loadPhotosWithThumbnails).toHaveBeenCalledWith('album-1', { page: 1 });
});

it('does not query when albumId is empty', () => {
  (photoService.loadPhotosWithThumbnails as ReturnType<typeof vi.fn>).mockResolvedValue({
    photos: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 }
  });
  const { Wrapper } = wrapper();

  renderHook(() => usePhotos(''), { wrapper: Wrapper });

  expect(photoService.loadPhotosWithThumbnails).not.toHaveBeenCalled();
});

it('falls back to page 1 / limit 20 pagination when the query has no data yet', () => {
  (photoService.loadPhotosWithThumbnails as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => usePhotos('album-1'), { wrapper: Wrapper });

  expect(result.current.pagination).toEqual({ page: 1, limit: 20, total: 0, pages: 0 });
});

it('surfaces a query error as a string message', async () => {
  (photoService.loadPhotosWithThumbnails as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => usePhotos('album-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.error).toBe('network down'));
});

it('updates a photo and invalidates the album and single-photo queries', async () => {
  (photoService.updatePhoto as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'photo-1', title: 'New' });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => usePhotos('album-1'), { wrapper: Wrapper });
  await result.current.updatePhoto('photo-1', { title: 'New' });

  expect(photoService.updatePhoto).toHaveBeenCalledWith('photo-1', { title: 'New' });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['photos', 'album-1'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['photo', 'photo-1'] });
});

it('deletes a photo and invalidates the photo, album, and albums-list queries', async () => {
  (photoService.deletePhoto as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => usePhotos('album-1'), { wrapper: Wrapper });
  await result.current.deletePhoto('photo-1');

  expect(photoService.deletePhoto).toHaveBeenCalledWith('photo-1');
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['photos', 'album-1'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['album', 'album-1'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['albums'] });
});
