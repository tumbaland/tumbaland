import { renderHook, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/publicApi', () => ({
  publicApi: { get: vi.fn() }
}));

import { publicApi } from '../services/publicApi';
import { useTodo } from './useTodo';

const mockedGet = publicApi.get as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('fetches a todo automatically on mount', async () => {
  mockedGet.mockResolvedValue({ todo: 'Write more tests' });
  const { result } = renderHook(() => useTodo());

  expect(result.current.isLoading).toBe(true);
  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(result.current.todo).toBe('Write more tests');
  expect(result.current.error).toBeNull();
});

it('sets an error message when the response has no todo', async () => {
  mockedGet.mockResolvedValue({ todo: '' });
  const { result } = renderHook(() => useTodo());

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBe('Invalid todo data received');
});

it('sets an error message when the fetch rejects', async () => {
  mockedGet.mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => useTodo());

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBe('network down');
});

it('ignores a concurrent fetchTodo call while one is already in flight', async () => {
  let resolveFirst: (value: { todo: string }) => void = () => {};
  mockedGet.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
  const { result } = renderHook(() => useTodo());

  await act(async () => {
    result.current.fetchTodo();
  });
  expect(mockedGet).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveFirst({ todo: 'Done' });
  });
  await waitFor(() => expect(result.current.todo).toBe('Done'));
});
