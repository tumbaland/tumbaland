import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const mockUseTenantFilter = vi.fn();
vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => mockUseTenantFilter() };
});

vi.mock('../services/collageService', () => ({
  collageService: {
    getCollages: vi.fn(),
    getCollageById: vi.fn(),
    createCollage: vi.fn(),
    updateCollage: vi.fn(),
    deleteCollage: vi.fn()
  }
}));

import { collageService } from '../services/collageService';
import { useCollageList, useCollageDetails, useCollageMutations } from './useCollage';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTenantFilter.mockReturnValue(undefined);
});

describe('useCollageList', () => {
  it('lists collages scoped to the tenant filter group', async () => {
    (collageService.getCollages as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: 'collage-1' }]);
    mockUseTenantFilter.mockReturnValue('group-1');
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useCollageList(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ _id: 'collage-1' }]);
    expect(collageService.getCollages).toHaveBeenCalledWith({ albumId: undefined, groupId: 'group-1' });
  });

  it('passes albumId through when given', async () => {
    (collageService.getCollages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useCollageList({ albumId: 'album-1' }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(collageService.getCollages).toHaveBeenCalledWith({ albumId: 'album-1', groupId: undefined });
  });

  it('does not query when enabled is false', () => {
    (collageService.getCollages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { Wrapper } = wrapper();

    renderHook(() => useCollageList({ enabled: false }), { wrapper: Wrapper });

    expect(collageService.getCollages).not.toHaveBeenCalled();
  });
});

describe('useCollageDetails', () => {
  it('fetches collage details by id', async () => {
    (collageService.getCollageById as ReturnType<typeof vi.fn>).mockResolvedValue({
      collage: { _id: 'collage-1' },
      albumPhotos: []
    });
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useCollageDetails('collage-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(collageService.getCollageById).toHaveBeenCalledWith('collage-1');
  });

  it('does not query when no collageId is given', () => {
    (collageService.getCollageById as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const { Wrapper } = wrapper();

    renderHook(() => useCollageDetails(undefined), { wrapper: Wrapper });

    expect(collageService.getCollageById).not.toHaveBeenCalled();
  });
});

describe('useCollageMutations', () => {
  it('creates a collage and invalidates the collages list', async () => {
    (collageService.createCollage as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'collage-1' });
    const { Wrapper, queryClient } = wrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCollageMutations(), { wrapper: Wrapper });
    const input = { title: 'Trip', config: {} as never, albumIds: ['album-1'] };
    await result.current.createCollage(input);

    expect(collageService.createCollage).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collages'] });
  });

  it('updates a collage and invalidates the list and its detail query', async () => {
    (collageService.updateCollage as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'collage-1' });
    const { Wrapper, queryClient } = wrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCollageMutations(), { wrapper: Wrapper });
    const input = { title: 'Renamed', config: {} as never, albumIds: ['album-1'] };
    await result.current.updateCollage('collage-1', input);

    expect(collageService.updateCollage).toHaveBeenCalledWith('collage-1', input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collages'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collages', 'detail', 'collage-1'] });
  });

  it('deletes a collage and invalidates the list and its detail query', async () => {
    (collageService.deleteCollage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { Wrapper, queryClient } = wrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCollageMutations(), { wrapper: Wrapper });
    await result.current.deleteCollage('collage-1');

    expect(collageService.deleteCollage).toHaveBeenCalledWith('collage-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collages'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collages', 'detail', 'collage-1'] });
  });
});
