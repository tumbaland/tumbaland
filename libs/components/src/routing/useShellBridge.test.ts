import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShellBridge } from './useShellBridge';
import { APP_SOURCE, SHELL_SOURCE } from './messages';

const APP_URL = 'https://album.tumbaland.eu';

function makeFrame() {
  const postMessage = vi.fn();
  const contentWindow = { postMessage };
  return {
    postMessage,
    ref: { current: { contentWindow } as unknown as HTMLIFrameElement },
    contentWindow
  };
}

function dispatchMessage(data: unknown, origin: string, source?: unknown) {
  const event = new MessageEvent('message', { data, origin });
  if (source !== undefined) Object.defineProperty(event, 'source', { value: source });
  window.dispatchEvent(event);
}

const appLocation = (path: string, title?: string) => ({
  source: APP_SOURCE,
  type: 'app:location',
  app: 'album-front',
  path,
  title
});

afterEach(() => vi.restoreAllMocks());

describe('useShellBridge', () => {
  it('mirrors a child location into the shell URL, replacing on the first report', () => {
    const frame = makeFrame();
    const onNavigate = vi.fn();

    renderHook(() =>
      useShellBridge({ frameRef: frame.ref, appRoute: '/album', appUrl: APP_URL, shellPath: '/album', onNavigate })
    );

    // The child's first report is its own default-route redirect.
    dispatchMessage(appLocation('/dashboard'), APP_URL, frame.contentWindow);
    expect(onNavigate).toHaveBeenCalledWith('/album/dashboard', { replace: true });

    dispatchMessage(appLocation('/albums/1'), APP_URL, frame.contentWindow);
    expect(onNavigate).toHaveBeenCalledWith('/album/albums/1', { replace: false });
  });

  it('forwards the child page title', () => {
    const frame = makeFrame();
    const onTitleChange = vi.fn();

    renderHook(() =>
      useShellBridge({
        frameRef: frame.ref,
        appRoute: '/album',
        appUrl: APP_URL,
        shellPath: '/album',
        onNavigate: vi.fn(),
        onTitleChange
      })
    );

    dispatchMessage(appLocation('/albums/1', 'Holiday 2026'), APP_URL, frame.contentWindow);
    expect(onTitleChange).toHaveBeenCalledWith('Holiday 2026');
  });

  it('ignores messages from another origin or another window', () => {
    const frame = makeFrame();
    const onNavigate = vi.fn();

    renderHook(() =>
      useShellBridge({ frameRef: frame.ref, appRoute: '/album', appUrl: APP_URL, shellPath: '/album', onNavigate })
    );

    dispatchMessage(appLocation('/albums/1'), 'https://evil.example', frame.contentWindow);
    dispatchMessage(appLocation('/albums/1'), APP_URL, { postMessage: vi.fn() });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('reports a logout inside the frame up to the shell', () => {
    const frame = makeFrame();
    const onChildLogout = vi.fn();

    renderHook(() =>
      useShellBridge({
        frameRef: frame.ref,
        appRoute: '/album',
        appUrl: APP_URL,
        shellPath: '/album',
        onNavigate: vi.fn(),
        onChildLogout
      })
    );

    dispatchMessage({ source: APP_SOURCE, type: 'app:logout' }, APP_URL, frame.contentWindow);
    expect(onChildLogout).toHaveBeenCalledTimes(1);
  });

  it('ignores a logout claim from another origin', () => {
    const frame = makeFrame();
    const onChildLogout = vi.fn();

    renderHook(() =>
      useShellBridge({
        frameRef: frame.ref,
        appRoute: '/album',
        appUrl: APP_URL,
        shellPath: '/album',
        onNavigate: vi.fn(),
        onChildLogout
      })
    );

    dispatchMessage({ source: APP_SOURCE, type: 'app:logout' }, 'https://evil.example', frame.contentWindow);
    expect(onChildLogout).not.toHaveBeenCalled();
  });

  it('pushes shell-initiated navigation down into the frame', () => {
    const frame = makeFrame();

    const { rerender } = renderHook(
      ({ shellPath }) =>
        useShellBridge({
          frameRef: frame.ref,
          appRoute: '/album',
          appUrl: APP_URL,
          shellPath,
          onNavigate: vi.fn()
        }),
      { initialProps: { shellPath: '/album' } }
    );

    frame.postMessage.mockClear();
    rerender({ shellPath: '/album/albums/1' });

    expect(frame.postMessage).toHaveBeenCalledWith(
      { source: SHELL_SOURCE, type: 'shell:navigate', path: '/albums/1' },
      APP_URL
    );
  });

  it('does not push a path the child just reported back down to it', () => {
    const frame = makeFrame();
    const onNavigate = vi.fn();

    const { rerender } = renderHook(
      ({ shellPath }) =>
        useShellBridge({ frameRef: frame.ref, appRoute: '/album', appUrl: APP_URL, shellPath, onNavigate }),
      { initialProps: { shellPath: '/album' } }
    );

    dispatchMessage(appLocation('/albums/1'), APP_URL, frame.contentWindow);
    frame.postMessage.mockClear();

    // The shell router now catches up to what the child already told us.
    rerender({ shellPath: '/album/albums/1' });
    expect(frame.postMessage).not.toHaveBeenCalled();
  });

  it('treats an in-app navigate-top URL as a shell route', () => {
    const frame = makeFrame();
    const onNavigate = vi.fn();

    renderHook(() =>
      useShellBridge({ frameRef: frame.ref, appRoute: '/album', appUrl: APP_URL, shellPath: '/album', onNavigate })
    );

    dispatchMessage(
      { source: 'album-front', type: 'tumbaland:navigate-top', url: `${APP_URL}/albums/1?x=2` },
      APP_URL,
      frame.contentWindow
    );

    expect(onNavigate).toHaveBeenCalledWith('/album/albums/1?x=2', { replace: true });
  });

  it('leaves the shell for an external navigate-top URL', () => {
    const frame = makeFrame();
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } });

    renderHook(() =>
      useShellBridge({
        frameRef: frame.ref,
        appRoute: '/album',
        appUrl: APP_URL,
        shellPath: '/album',
        onNavigate: vi.fn()
      })
    );

    dispatchMessage(
      { source: 'album-front', type: 'tumbaland:navigate-top', url: 'https://checkout.stripe.com/c/cs_123' },
      APP_URL,
      frame.contentWindow
    );

    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_123');
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('ignores an unparseable navigate-top URL', () => {
    const frame = makeFrame();
    const onNavigate = vi.fn();

    renderHook(() =>
      useShellBridge({ frameRef: frame.ref, appRoute: '/album', appUrl: APP_URL, shellPath: '/album', onNavigate })
    );

    dispatchMessage({ source: 'album-front', type: 'tumbaland:navigate-top', url: '::::' }, APP_URL, frame.contentWindow);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when no app is selected', () => {
    const frame = makeFrame();
    const onNavigate = vi.fn();

    renderHook(() => useShellBridge({ frameRef: frame.ref, shellPath: '/', onNavigate }));

    dispatchMessage(appLocation('/albums/1'), APP_URL, frame.contentWindow);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(frame.postMessage).not.toHaveBeenCalled();
  });

  it('skips posting when the frame has not mounted yet', () => {
    const onNavigate = vi.fn();
    const emptyRef = { current: null };

    expect(() =>
      renderHook(() =>
        useShellBridge({ frameRef: emptyRef, appRoute: '/album', appUrl: APP_URL, shellPath: '/album', onNavigate })
      )
    ).not.toThrow();
  });

  describe('auth requests from the framed app', () => {
    const authRequest = (id = 'req-1') => ({ source: APP_SOURCE, type: 'app:auth-request', id });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("answers with the shell's own auth state, to the frame's origin only", async () => {
      const frame = makeFrame();
      const user = { id: '1', email: 'a@b.com' };
      const onAuthRequest = vi.fn().mockResolvedValue({ authenticated: true, user });

      renderHook(() =>
        useShellBridge({
          frameRef: frame.ref,
          appRoute: '/album',
          appUrl: APP_URL,
          shellPath: '/album',
          onNavigate: vi.fn(),
          onAuthRequest
        })
      );

      dispatchMessage(authRequest(), APP_URL, frame.contentWindow);
      await flush();

      expect(onAuthRequest).toHaveBeenCalledTimes(1);
      expect(frame.postMessage).toHaveBeenCalledWith(
        { source: SHELL_SOURCE, type: 'shell:auth', id: 'req-1', authenticated: true, user },
        APP_URL
      );
    });

    it('ignores requests from another origin or another window', async () => {
      const frame = makeFrame();
      const onAuthRequest = vi.fn().mockResolvedValue({ authenticated: true, user: null });

      renderHook(() =>
        useShellBridge({
          frameRef: frame.ref,
          appRoute: '/album',
          appUrl: APP_URL,
          shellPath: '/album',
          onNavigate: vi.fn(),
          onAuthRequest
        })
      );

      dispatchMessage(authRequest(), 'https://evil.example', frame.contentWindow);
      dispatchMessage(authRequest(), APP_URL, { postMessage: vi.fn() });
      await flush();

      expect(onAuthRequest).not.toHaveBeenCalled();
    });

    it('leaves the request unanswered when the shell has no auth state to give', async () => {
      const frame = makeFrame();

      renderHook(() =>
        useShellBridge({ frameRef: frame.ref, appRoute: '/album', appUrl: APP_URL, shellPath: '/album', onNavigate: vi.fn() })
      );
      frame.postMessage.mockClear();

      dispatchMessage(authRequest(), APP_URL, frame.contentWindow);
      await flush();

      expect(frame.postMessage).not.toHaveBeenCalled();
    });
  });
});
