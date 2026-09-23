import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QUICK_REACTIONS } from './EmojiPicker';
import { emojiIn, recordEmoji, resetRecentEmojiCache, useRecentEmoji } from './recentEmoji';

describe('recent emoji', () => {
  beforeEach(() => {
    window.localStorage.removeItem('tumbaland-chat-recent-emoji');
    resetRecentEmojiCache();
  });

  it('starts with the quick reactions', () => {
    const { result } = renderHook(() => useRecentEmoji());
    expect(result.current).toEqual([...QUICK_REACTIONS]);
  });

  it('puts the latest first without repeating it', () => {
    const { result } = renderHook(() => useRecentEmoji());

    act(() => recordEmoji('🎉'));
    act(() => recordEmoji('😂'));

    expect(result.current.slice(0, 3)).toEqual(['😂', '🎉', '❤️']);
    expect(result.current.filter((emoji) => emoji === '😂')).toHaveLength(1);
  });

  it('keeps the list short', () => {
    const { result } = renderHook(() => useRecentEmoji());
    act(() => recordEmoji(...'🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆'.match(/\p{Extended_Pictographic}/gu)!));
    expect(result.current).toHaveLength(16);
  });

  it('survives a reload', () => {
    recordEmoji('🦄');
    resetRecentEmojiCache();
    const { result } = renderHook(() => useRecentEmoji());
    expect(result.current[0]).toBe('🦄');
  });
});

describe('emojiIn', () => {
  it('finds the emoji in a message, whole', () => {
    expect(emojiIn('see you 👋🏽 at 8 🇪🇪!')).toEqual(['👋🏽', '🇪🇪']);
  });

  it('finds none in plain text or digits', () => {
    expect(emojiIn('123 # * hello')).toEqual([]);
  });
});
