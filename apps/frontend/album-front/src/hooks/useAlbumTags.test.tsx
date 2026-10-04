import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/photoService', () => ({
  photoService: {
    getAlbumTags: vi.fn(),
    bulkUpdateTags: vi.fn()
  }
}));

import { photoService } from '../services/photoService';
import { useAlbumTags, useBulkTagMutation, albumTagKeys } from './useAlbumTags';

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

it('fetches the album tag list', async () => {
  (photoService.getAlbumTags as ReturnType<typeof vi.fn>).mockResolvedValue([{ tag: 'beach', count: 3 }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAlbumTags('album-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.tags).toEqual([{ tag: 'beach', count: 3 }]));
  expect(photoService.getAlbumTags).toHaveBeenCalledWith('album-1');
});

it('stays idle without an album id', () => {
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAlbumTags(''), { wrapper: Wrapper });

  expect(photoService.getAlbumTags).not.toHaveBeenCalled();
  expect(result.current.tags).toEqual([]);
});

it('surfaces a fetch error as a message', async () => {
  (photoService.getAlbumTags as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAlbumTags('album-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.error).toBe('offline'));
});

it('invalidates the album photo lists and its tag vocabulary after a bulk change', async () => {
  (photoService.bulkUpdateTags as ReturnType<typeof vi.fn>).mockResolvedValue({
    matched: 2,
    modified: 2,
    tags: []
  });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useBulkTagMutation('album-1'), { wrapper: Wrapper });
  await result.current.bulkUpdateTags({ photoIds: ['p1', 'p2'], add: ['beach'] });

  expect(photoService.bulkUpdateTags).toHaveBeenCalledWith(['p1', 'p2'], { add: ['beach'], remove: undefined });
  const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify((arg as { queryKey: unknown }).queryKey));
  expect(keys).toContain(JSON.stringify(['photos', 'album-1']));
  expect(keys).toContain(JSON.stringify(albumTagKeys.album('album-1')));
  expect(keys).toContain(JSON.stringify(['photo', 'p1']));
  expect(keys).toContain(JSON.stringify(['photo', 'p2']));
});
