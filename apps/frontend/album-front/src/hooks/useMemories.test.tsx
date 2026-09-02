import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../services/photoService', () => ({
  photoService: { getMemories: vi.fn() }
}));

import { photoService } from '../services/photoService';
import { useMemories } from './useMemories';

const mockedGetMemories = photoService.getMemories as ReturnType<typeof vi.fn>;

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const memories = { date: '2026-09-03', windowDays: 3, totalPhotos: 1, years: [] };

beforeEach(() => vi.clearAllMocks());

it('is loading with null memories before the query resolves', () => {
  mockedGetMemories.mockReturnValue(new Promise(() => {}));

  const { result } = renderHook(() => useMemories(), { wrapper: wrapper() });

  expect(result.current.loading).toBe(true);
  expect(result.current.memories).toBeNull();
});

it('fetches the personal scope when no groupId is given', async () => {
  mockedGetMemories.mockResolvedValue(memories);

  const { result } = renderHook(() => useMemories(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockedGetMemories).toHaveBeenCalledWith({ groupId: undefined });
  expect(result.current.memories).toEqual(memories);
});

it('fetches a group scope when a groupId is given', async () => {
  mockedGetMemories.mockResolvedValue(memories);

  const { result } = renderHook(() => useMemories('g1'), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockedGetMemories).toHaveBeenCalledWith({ groupId: 'g1' });
});

it('surfaces a failure as an error message', async () => {
  mockedGetMemories.mockRejectedValue(new Error('boom'));

  const { result } = renderHook(() => useMemories(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.error).toBe('boom'));
  expect(result.current.memories).toBeNull();
});
