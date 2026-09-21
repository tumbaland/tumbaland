import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const setBadge = vi.fn();
let config: Record<string, string | undefined> = {};

vi.mock('../config/ConfigProvider', () => ({ getGlobalConfig: () => config }));
vi.mock('../services/pushNotifications', () => ({ setBadge: (count: number) => setBadge(count) }));

import { useUnreadChat } from './useUnreadChat';

let visibility: DocumentVisibilityState = 'visible';
const fetchMock = vi.fn();

const unread = (count: number) => ({ ok: true, json: async () => ({ data: { unread: count } }) });

beforeEach(() => {
  config = { CHAT_API_URL: 'https://chat-api.test' };
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
  fetchMock.mockResolvedValue(unread(3));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useUnreadChat', () => {
  it('reads the count and reports it', async () => {
    const { result } = renderHook(() => useUnreadChat(true));

    await waitFor(() => expect(result.current).toBe(3));
  });

  it('sends the session cookie, since the count is per person', async () => {
    renderHook(() => useUnreadChat(true));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat-api.test/api/chat/unread',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('sets the badge on the installed app icon', async () => {
    renderHook(() => useUnreadChat(true));

    await waitFor(() => expect(setBadge).toHaveBeenCalledWith(3));
  });

  it('asks for nothing while signed out, and clears the badge', () => {
    renderHook(() => useUnreadChat(false));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setBadge).toHaveBeenCalledWith(0);
  });

  it('asks for nothing when chat is not configured for this deployment', () => {
    config = {};

    renderHook(() => useUnreadChat(true));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not poll while the tab is hidden, where push is the path instead', async () => {
    visibility = 'hidden';

    renderHook(() => useUnreadChat(true));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the last count when a poll fails', async () => {
    const { result } = renderHook(() => useUnreadChat(true));
    await waitFor(() => expect(result.current).toBe(3));

    fetchMock.mockRejectedValue(new Error('offline'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // The number simply does not move until a poll succeeds.
    expect(result.current).toBe(3);
  });

  it('ignores a refused response rather than resetting to zero', async () => {
    const { result } = renderHook(() => useUnreadChat(true));
    await waitFor(() => expect(result.current).toBe(3));

    fetchMock.mockResolvedValue({ ok: false });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result.current).toBe(3);
  });

  it('stops polling when unmounted', async () => {
    const { unmount } = renderHook(() => useUnreadChat(true));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();
    const callsAfterUnmount = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock.mock.calls.length).toBe(callsAfterUnmount);
  });
});
