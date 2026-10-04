import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/albumService', () => ({
  albumService: { getAlbumStatistics: vi.fn() }
}));

import { albumService } from '../services/albumService';
import { useStatistics } from './useStatistics';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

it('is loading with null statistics before the query resolves', () => {
  (albumService.getAlbumStatistics as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

  const { result } = renderHook(() => useStatistics(), { wrapper: wrapper() });

  expect(result.current.loading).toBe(true);
  expect(result.current.statistics).toBeNull();
});

it('fetches personal statistics when no groupId is given', async () => {
  (albumService.getAlbumStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({ overview: { totalAlbums: 3 } });

  const { result } = renderHook(() => useStatistics(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.statistics).toEqual({ overview: { totalAlbums: 3 } });
  expect(albumService.getAlbumStatistics).toHaveBeenCalledWith({ groupId: undefined });
});

it('fetches group-scoped statistics when a groupId is given', async () => {
  (albumService.getAlbumStatistics as ReturnType<typeof vi.fn>).mockResolvedValue({ overview: { totalAlbums: 5 } });

  const { result } = renderHook(() => useStatistics('group-1'), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(albumService.getAlbumStatistics).toHaveBeenCalledWith({ groupId: 'group-1' });
});

it('surfaces an Error instance as its message', async () => {
  (albumService.getAlbumStatistics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

  const { result } = renderHook(() => useStatistics(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.error).toBe('network down'));
});

it('surfaces a non-Error rejection as a generic message', async () => {
  (albumService.getAlbumStatistics as ReturnType<typeof vi.fn>).mockRejectedValue('boom');

  const { result } = renderHook(() => useStatistics(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.error).toBe('Failed to load dashboard statistics'));
});
