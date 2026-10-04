import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/snapshotService', () => ({
  getSnapshots: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn()
}));

import * as snapshotService from '../services/snapshotService';
import { useSnapshots, useSaveSnapshot, useDeleteSnapshot } from './useSnapshots';

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

it('fetches snapshots scoped to a group', async () => {
  (snapshotService.getSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: 's1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useSnapshots('group-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(snapshotService.getSnapshots).toHaveBeenCalledWith('group-1');
});

it('saves a snapshot and invalidates snapshots/dashboard', async () => {
  (snapshotService.saveSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 's1' });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useSaveSnapshot(), { wrapper: Wrapper });
  result.current.mutate({ month: '2024-05', entries: [], groupId: 'g1' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(snapshotService.saveSnapshot).toHaveBeenCalledWith('2024-05', [], 'g1');
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['snapshots'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
});

it('deletes a snapshot', async () => {
  (snapshotService.deleteSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useDeleteSnapshot(), { wrapper: Wrapper });
  result.current.mutate('s1');

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(snapshotService.deleteSnapshot).toHaveBeenCalledWith('s1', expect.anything());
});
