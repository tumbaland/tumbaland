import { render, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedRouter } from './EmbeddedRouter';
import { APP_SOURCE, SHELL_SOURCE } from './messages';

const SHELL_URL = 'https://tumbaland.eu';

function TestRoutes() {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/" element={<button onClick={() => navigate('/albums/1')}>home</button>} />
      <Route path="/albums/:id" element={<div>album page</div>} />
    </Routes>
  );
}

const originalTop = window.top;
const originalParent = window.parent;

/** Make the page look framed, with a spy standing in for the shell window. */
function frameThePage() {
  const postMessage = vi.fn();
  Object.defineProperty(window, 'top', { configurable: true, value: {} });
  Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
  return postMessage;
}

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`);
}

afterEach(() => {
  Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
  Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('EmbeddedRouter', () => {
  it('uses a browser router when the page is not framed', async () => {
    setSearch('?embedded=1&embedPath=/albums/1');
    // Flagged but top-level: a direct visit must not be treated as embedded.
    render(
      <EmbeddedRouter appName="album-front" shellUrl={SHELL_URL}>
        <TestRoutes />
      </EmbeddedRouter>
    );

    expect(await screen.findByText('home')).toBeInTheDocument();
  });

  it('boots the memory router on the deep-linked path from the iframe src', async () => {
    frameThePage();
    setSearch('?embedded=1&embedPath=/albums/1');

    render(
      <EmbeddedRouter appName="album-front" shellUrl={SHELL_URL}>
        <TestRoutes />
      </EmbeddedRouter>
    );

    expect(await screen.findByText('album page')).toBeInTheDocument();
  });

  it('reports its location to the shell origin', async () => {
    const postMessage = frameThePage();
    setSearch('?embedded=1&embedPath=/albums/1');

    render(
      <EmbeddedRouter appName="album-front" shellUrl={`${SHELL_URL}/some/path`}>
        <TestRoutes />
      </EmbeddedRouter>
    );

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ source: APP_SOURCE, type: 'app:location', app: 'album-front', path: '/albums/1' }),
        SHELL_URL
      )
    );
  });

  it('adopts a path pushed down by the shell without echoing it back', async () => {
    const postMessage = frameThePage();
    setSearch('?embedded=1&embedPath=/');

    render(
      <EmbeddedRouter appName="album-front" shellUrl={SHELL_URL}>
        <TestRoutes />
      </EmbeddedRouter>
    );

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    postMessage.mockClear();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: SHELL_SOURCE, type: 'shell:navigate', path: '/albums/1' },
        origin: SHELL_URL
      })
    );

    expect(await screen.findByText('album page')).toBeInTheDocument();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('ignores navigation messages from any other origin', async () => {
    frameThePage();
    setSearch('?embedded=1&embedPath=/');

    render(
      <EmbeddedRouter appName="album-front" shellUrl={SHELL_URL}>
        <TestRoutes />
      </EmbeddedRouter>
    );
    await screen.findByText('home');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { source: SHELL_SOURCE, type: 'shell:navigate', path: '/albums/1' },
        origin: 'https://evil.example'
      })
    );

    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
  });

  it('stays silent when no shell URL is configured', async () => {
    const postMessage = frameThePage();
    setSearch('?embedded=1&embedPath=/');

    render(
      <EmbeddedRouter appName="album-front">
        <TestRoutes />
      </EmbeddedRouter>
    );

    await screen.findByText('home');
    expect(postMessage).not.toHaveBeenCalled();
  });
});
