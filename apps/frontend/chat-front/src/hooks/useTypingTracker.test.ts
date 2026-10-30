import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import { TYPING_TIMEOUT_MS, assistantsWorking, namesTyping, useTypingTracker } from './useTypingTracker';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('namesTyping', () => {
  const map = { c1: { u1: { name: 'Irja', at: 1 }, u2: { name: 'Sam', at: 2 } } };

  it('lists who is typing in one conversation', () => {
    expect(namesTyping(map, 'c1')).toEqual(['Irja', 'Sam']);
  });

  it('lists nobody for a conversation nobody is typing in, or none at all', () => {
    expect(namesTyping(map, 'c2')).toEqual([]);
    expect(namesTyping(map, undefined)).toEqual([]);
  });
});

describe('assistants at work', () => {
  const map = {
    c1: {
      u1: { name: 'Irja', at: 1 },
      'bot:b1': { name: 'Tumbi', at: 2, bot: true, activity: 'making a collage' },
      'bot:b2': { name: 'Bubu', at: 3, bot: true }
    }
  };

  it('are listed apart from the people, who are all the header and the list ever name', () => {
    expect(namesTyping(map, 'c1')).toEqual(['Irja']);
    expect(assistantsWorking(map, 'c1')).toEqual([
      { name: 'Tumbi', activity: 'making a collage' },
      { name: 'Bubu', activity: undefined }
    ]);
  });

  it('are nobody in a conversation with none, or with none open', () => {
    expect(assistantsWorking(map, 'c2')).toEqual([]);
    expect(assistantsWorking(map, undefined)).toEqual([]);
  });

  it('are noted with what they are doing, and expire like anyone else', () => {
    const { result } = renderHook(() => useTypingTracker());
    act(() => result.current.note('c1', 'bot:b1', 'Tumbi', { bot: true, activity: 'planning' }));
    expect(assistantsWorking(result.current.typing, 'c1')).toEqual([{ name: 'Tumbi', activity: 'planning' }]);
    act(() => {
      vi.advanceTimersByTime(TYPING_TIMEOUT_MS + 1500);
    });
    expect(assistantsWorking(result.current.typing, 'c1')).toEqual([]);
  });
});

describe('useTypingTracker', () => {
  it('notes who is typing where', () => {
    const { result } = renderHook(() => useTypingTracker());

    act(() => result.current.note('c1', 'u1', 'Irja'));
    act(() => result.current.note('c1', 'u2', 'Sam'));

    expect(namesTyping(result.current.typing, 'c1')).toEqual(['Irja', 'Sam']);
  });

  it('puts the dots out at once for someone who sent their message', () => {
    const { result } = renderHook(() => useTypingTracker());
    act(() => result.current.note('c1', 'u1', 'Irja'));
    act(() => result.current.note('c1', 'u2', 'Sam'));

    act(() => result.current.clear('c1', 'u1'));

    expect(namesTyping(result.current.typing, 'c1')).toEqual(['Sam']);
  });

  it('leaves things as they are when clearing someone who was not typing', () => {
    const { result } = renderHook(() => useTypingTracker());
    act(() => result.current.note('c1', 'u1', 'Irja'));
    const before = result.current.typing;

    act(() => result.current.clear('c1', 'nobody'));
    act(() => result.current.clear('other', 'u1'));

    expect(result.current.typing).toBe(before);
  });

  it('lets a notice lapse when no more come, in case the sender closed the tab mid-word', () => {
    const { result } = renderHook(() => useTypingTracker());
    act(() => result.current.note('c1', 'u1', 'Irja'));

    act(() => {
      vi.advanceTimersByTime(TYPING_TIMEOUT_MS - 1000);
    });
    expect(namesTyping(result.current.typing, 'c1')).toEqual(['Irja']);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(namesTyping(result.current.typing, 'c1')).toEqual([]);
  });

  it('keeps a notice that is renewed, and lets only the stale one lapse', () => {
    const { result } = renderHook(() => useTypingTracker());
    act(() => result.current.note('c1', 'u1', 'Irja'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => result.current.note('c1', 'u2', 'Sam'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(namesTyping(result.current.typing, 'c1')).toEqual(['Sam']);
  });

  it('stops checking once nobody is typing', () => {
    const { result } = renderHook(() => useTypingTracker());
    act(() => result.current.note('c1', 'u1', 'Irja'));
    expect(vi.getTimerCount()).toBe(1);

    act(() => result.current.clear('c1', 'u1'));

    expect(vi.getTimerCount()).toBe(0);
  });
});
