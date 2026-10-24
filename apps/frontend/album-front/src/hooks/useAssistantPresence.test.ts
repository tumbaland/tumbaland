import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import { ASSISTANT_QUIET_MS, useAssistantPresence } from './useAssistantPresence';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAssistantPresence', () => {
  it('shows an assistant from its first change, under its connection’s name', () => {
    const { result } = renderHook(() => useAssistantPresence());
    expect(result.current.person).toBeNull();

    act(() => result.current.noteChange({ userId: 'u1', name: 'Claude', assistant: true }));

    expect(result.current.person).toMatchObject({ name: 'Claude', picture: null, selection: null });
  });

  it('ignores changes a person made', () => {
    const { result } = renderHook(() => useAssistantPresence());

    act(() => result.current.noteChange({ userId: 'u1', name: 'Irja' }));

    expect(result.current.person).toBeNull();
  });

  it('stops showing it once it has been quiet for a minute, counted from its last change', () => {
    const { result } = renderHook(() => useAssistantPresence());

    act(() => result.current.noteChange({ userId: 'u1', name: 'Claude', assistant: true }));
    void act(() => vi.advanceTimersByTime(ASSISTANT_QUIET_MS - 1000));
    act(() => result.current.noteChange({ userId: 'u1', name: 'Claude', assistant: true }));
    void act(() => vi.advanceTimersByTime(ASSISTANT_QUIET_MS - 1000));
    expect(result.current.person).not.toBeNull();

    void act(() => vi.advanceTimersByTime(1000));
    expect(result.current.person).toBeNull();
  });
});
