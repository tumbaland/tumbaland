import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tumbaland/frontend-core';
import { describe, expect, it, vi } from 'vite-plus/test';
import { describeError, useLoad } from './useLoad';

describe('useLoad', () => {
  it('loads when it opens', async () => {
    const { result } = renderHook(() => useLoad(async () => 'result', []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('result');
    expect(result.current.error).toBeNull();
  });

  it('says what went wrong', async () => {
    const { result } = renderHook(() => useLoad(async () => Promise.reject(new ApiError(500, 'boom')), []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('loads again when what it depends on changes, keeping the old result up meanwhile', async () => {
    let release!: (value: string) => void;
    const load = vi
      .fn<(page: number) => Promise<string>>()
      .mockResolvedValueOnce('page 1')
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { result, rerender } = renderHook(({ page }) => useLoad(() => load(page), [page]), { initialProps: { page: 1 } });
    await waitFor(() => expect(result.current.data).toBe('page 1'));

    rerender({ page: 2 });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('page 1');
    await act(async () => release('page 2'));
    expect(result.current.data).toBe('page 2');
  });

  it('drops the answer to a request that has been replaced', async () => {
    const resolvers: Array<(value: string) => void> = [];
    const load = (page: number) => new Promise<string>((resolve) => resolvers.push((value) => resolve(`${page}:${value}`)));
    const { result, rerender } = renderHook(({ page }) => useLoad(() => load(page), [page]), { initialProps: { page: 1 } });

    rerender({ page: 2 });
    await act(async () => resolvers[1]('late'));
    await act(async () => resolvers[0]('early'));

    expect(result.current.data).toBe('2:late');
  });

  it('keeps the old result and shows the error when a reload fails', async () => {
    const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce('first').mockRejectedValueOnce(new ApiError(500, 'down'));
    const { result } = renderHook(() => useLoad(load, []));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.error).toBe('down'));
    expect(result.current.data).toBe('first');
  });

  it('clears the error on the next success', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new ApiError(500, 'down')).mockResolvedValueOnce('fine');
    const { result } = renderHook(() => useLoad(load, []));
    await waitFor(() => expect(result.current.error).toBe('down'));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBe('fine'));
    expect(result.current.error).toBeNull();
  });
});

describe('describeError', () => {
  it('tells a non-administrator what this is', () => {
    expect(describeError(new ApiError(403, 'admin required'))).toBe('This area is for administrators.');
    expect(describeError(new ApiError(403, 'Forbidden'))).toBe('This area is for administrators.');
  });

  it('passes on a refusal that explains itself', () => {
    expect(describeError(new ApiError(403, 'You cannot close your own account from here'))).toBe(
      'You cannot close your own account from here'
    );
  });

  it('says something does not exist', () => {
    expect(describeError(new ApiError(404, 'User not found'))).toBe('That does not exist.');
  });

  it('passes on the server’s own words for anything else', () => {
    expect(describeError(new ApiError(409, 'This account is already closed'))).toBe('This account is already closed');
  });

  it('says it could not reach the server when there was no answer', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toBe('Could not reach the server.');
  });
});
