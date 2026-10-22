import { describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import { useThreadSearch } from './useThreadSearch';

const setup = (outcome: Promise<'found' | 'gone' | 'too-far'>) => {
  const loadUntil = vi.fn(() => outcome);
  const onError = vi.fn();
  const hook = renderHook(() => useThreadSearch('c1', 'u-tom', { members: [], loadUntil }, onError));
  return { ...hook, loadUntil, onError };
};

describe('useThreadSearch', () => {
  it('opens the dialog, and a pick closes it and goes to the message', async () => {
    const { result, loadUntil } = setup(Promise.resolve('found'));

    act(() => result.current.open());
    expect(result.current.dialog.open).toBe(true);

    await act(async () => result.current.dialog.onPick({ id: 'm9', createdAt: '2026-10-01T10:00:00Z' } as never));

    expect(result.current.dialog.open).toBe(false);
    expect(loadUntil).toHaveBeenCalledWith('m9', '2026-10-01T10:00:00Z');
    expect(result.current.focus?.id).toBe('m9');
    expect(result.current.jumping).toBe(false);
  });

  it.each([
    ['too-far' as const, 'That message is too far back to open here.'],
    ['gone' as const, 'That message is no longer in the chat.']
  ])('says why it cannot open a message that is %s', async (outcome, words) => {
    const { result, onError } = setup(Promise.resolve(outcome));
    await act(() => result.current.jumpTo('m9', '2026-10-01T10:00:00Z'));
    expect(onError).toHaveBeenCalledWith(words);
  });

  it('says so when loading fails, and closes on Close', async () => {
    const { result, onError } = setup(Promise.reject(new Error('offline')));
    await act(() => result.current.jumpTo('m9', '2026-10-01T10:00:00Z'));
    expect(onError).toHaveBeenCalledWith('Could not open that message. Try again.');

    act(() => result.current.open());
    act(() => result.current.dialog.onClose());
    expect(result.current.dialog.open).toBe(false);
  });
});
