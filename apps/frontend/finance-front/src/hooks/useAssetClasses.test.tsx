import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/assetClassService', () => ({
  getAssetClasses: vi.fn(),
  createAssetClass: vi.fn(),
  updateAssetClass: vi.fn(),
  deleteAssetClass: vi.fn()
}));

import * as assetClassService from '../services/assetClassService';
import {
  useAssetClasses,
  useCreateAssetClass,
  useUpdateAssetClass,
  useDeleteAssetClass
} from './useAssetClasses';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { Wrapper: ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ), queryClient };
}

beforeEach(() => vi.clearAllMocks());

it('fetches asset classes scoped to a group', async () => {
  (assetClassService.getAssetClasses as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: 'a1' }]);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAssetClasses('group-1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(assetClassService.getAssetClasses).toHaveBeenCalledWith({ groupId: 'group-1' });
  expect(result.current.data).toEqual([{ _id: 'a1' }]);
});

it('fetches all asset classes when no group is given', async () => {
  (assetClassService.getAssetClasses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  const { Wrapper } = wrapper();

  renderHook(() => useAssetClasses(), { wrapper: Wrapper });

  await waitFor(() => expect(assetClassService.getAssetClasses).toHaveBeenCalledWith(undefined));
});

it('creates an asset class and invalidates related queries on success', async () => {
  (assetClassService.createAssetClass as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'a2' });
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateAssetClass(), { wrapper: Wrapper });
  result.current.mutate({ name: 'Bonds', userId: 'u1' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assetClasses'] });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
});

it('updates an asset class', async () => {
  (assetClassService.updateAssetClass as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'a1', name: 'Renamed' });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateAssetClass(), { wrapper: Wrapper });
  result.current.mutate({ id: 'a1', data: { name: 'Renamed' } });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(assetClassService.updateAssetClass).toHaveBeenCalledWith('a1', { name: 'Renamed' });
});

it('deletes an asset class', async () => {
  (assetClassService.deleteAssetClass as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useDeleteAssetClass(), { wrapper: Wrapper });
  result.current.mutate('a1');

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(assetClassService.deleteAssetClass).toHaveBeenCalledWith('a1', expect.anything());
});
