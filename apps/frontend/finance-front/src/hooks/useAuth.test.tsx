import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    redirectToLogin: vi.fn(),
    logout: vi.fn()
  }
}));

import { authService } from '../services/authService';
import { useAuth, useCurrentUser, useLogin, useLogout } from './useAuth';

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

it('useAuth reports the checkAuth result', async () => {
  (authService.checkAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authenticated: true, user: { id: 'u1' } });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual({ authenticated: true, user: { id: 'u1' } });
});

it('useCurrentUser extracts just the user from checkAuth', async () => {
  (authService.checkAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authenticated: true, user: { id: 'u1' } });
  const { Wrapper } = wrapper();

  const { result } = renderHook(() => useCurrentUser(), { wrapper: Wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual({ id: 'u1' });
});

it('useLogin redirects to login and invalidates auth queries', async () => {
  const { Wrapper, queryClient } = wrapper();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
  result.current.mutate();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(authService.redirectToLogin).toHaveBeenCalled();
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth'] });
});

it('useLogout clears the entire query cache on success', async () => {
  (authService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  const { Wrapper, queryClient } = wrapper();
  const clearSpy = vi.spyOn(queryClient, 'clear');

  const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
  result.current.mutate();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(clearSpy).toHaveBeenCalled();
});
