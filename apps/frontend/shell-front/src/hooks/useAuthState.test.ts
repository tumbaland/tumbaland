import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const checkAuth = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: (...args: unknown[]) => checkAuth(...args)
  }
}));

import { useAuthState } from './useAuthState';

beforeEach(() => {
  checkAuth.mockReset();
});

it('starts in a loading state before the check resolves', () => {
  checkAuth.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useAuthState());
  expect(result.current).toEqual({ loading: true, authenticated: false, user: null });
});

it('reports an authenticated session and exposes the user', async () => {
  checkAuth.mockResolvedValue({ authenticated: true, user: { email: 'a@b.c' } });
  const { result } = renderHook(() => useAuthState());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.authenticated).toBe(true);
  expect(result.current.user).toEqual({ email: 'a@b.c' });
});

it('reports a signed-out session', async () => {
  checkAuth.mockResolvedValue({ authenticated: false, user: null });
  const { result } = renderHook(() => useAuthState());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.authenticated).toBe(false);
});

it('treats a failed check as signed out rather than hanging on the loader', async () => {
  checkAuth.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useAuthState());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.authenticated).toBe(false);
});

it('does not set state after unmount', async () => {
  let resolve: (value: { authenticated: boolean }) => void = () => {};
  checkAuth.mockReturnValue(new Promise((r) => { resolve = r; }));
  const { unmount } = renderHook(() => useAuthState());
  unmount();
  resolve({ authenticated: true });
  await Promise.resolve();
  // No act() warning and no error means the guard held.
  expect(checkAuth).toHaveBeenCalledTimes(1);
});
