import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/statementSettingsService', () => ({
  getStatementSettings: vi.fn(),
  updateStatementSettings: vi.fn()
}));

import * as service from '../services/statementSettingsService';
import { useStatementSettings, useUpdateStatementSettings } from './useStatementSettings';

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return {
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    queryClient
  };
}

beforeEach(() => vi.clearAllMocks());

it('fetches the settings for the current context', async () => {
  mocked(service.getStatementSettings).mockResolvedValue({ ownerNames: ['ALEX SMITH'] });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useStatementSettings('g1'), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.data).toEqual({ ownerNames: ['ALEX SMITH'] }));
  expect(service.getStatementSettings).toHaveBeenCalledWith('g1');
});

it('saves the names', async () => {
  mocked(service.updateStatementSettings).mockResolvedValue({ ownerNames: [] });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useUpdateStatementSettings(), { wrapper: Wrapper });
  await result.current.mutateAsync({ ownerNames: ['ALEX SMITH'], groupId: 'g1' });

  expect(service.updateStatementSettings).toHaveBeenCalledWith(['ALEX SMITH'], 'g1');
});

it('refreshes only the settings, since no transaction has changed', async () => {
  mocked(service.updateStatementSettings).mockResolvedValue({ ownerNames: [] });
  const { Wrapper, queryClient } = wrapper();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useUpdateStatementSettings(), { wrapper: Wrapper });
  await result.current.mutateAsync({ ownerNames: ['ALEX SMITH'] });

  const keys = invalidate.mock.calls.map(([arg]) => arg?.queryKey?.[0]);
  expect(keys).toEqual(['statementSettings']);
});
