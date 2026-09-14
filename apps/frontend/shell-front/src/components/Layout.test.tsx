import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn().mockResolvedValue({ authenticated: false, user: null }),
    isAuthenticated: vi.fn().mockResolvedValue(true),
    redirectToLogin: vi.fn(),
    logout: vi.fn()
  }
}));

import Layout from './Layout';
import { ConfigContext } from '../config/ConfigProvider';
import { authService } from '../services/authService';

type AuthResult = Awaited<ReturnType<typeof authService.checkAuth>>;

/**
 * Layout's useAuthState calls checkAuth on every mount, so per-test sessions
 * are set with mockResolvedValue rather than a single mockResolvedValueOnce.
 */
function setSession(authenticated: boolean) {
  vi.mocked(authService.checkAuth).mockResolvedValue({
    authenticated,
    user: authenticated ? { email: 'a@b.c' } : null
  } as AuthResult);
}

function setMobile(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

function renderAt(path: string, config: Record<string, string> = {}) {
  return render(
    <ConfigContext.Provider value={config as any}>
      <MemoryRouter initialEntries={[path]}>
        <Layout>
          <div>page content</div>
        </Layout>
      </MemoryRouter>
    </ConfigContext.Provider>
  );
}

beforeEach(() => {
  setSession(false);
  setMobile(false);
});

it('renders children directly on the home route (no iframe)', () => {
  renderAt('/');
  expect(screen.getByText('page content')).toBeInTheDocument();
  expect(document.querySelector('iframe')).toBeNull();
});

it('renders children when the route has no configured app url', () => {
  renderAt('/relationship', {});
  expect(screen.getByText('page content')).toBeInTheDocument();
});

it('renders a protected iframe and hides the loader once it loads', async () => {
  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  const iframe = await screen.findByTitle('Journal');
  expect(iframe).toHaveAttribute('src', 'https://relationship.example/?embedded=1&embedPath=%2F');
  expect(screen.getByRole('progressbar')).toBeInTheDocument();

  iframe.dispatchEvent(new Event('load'));
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
});

it('boots the iframe on a nested route and keeps the src stable as the child navigates', async () => {
  renderAt('/relationship/journal', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  const iframe = await screen.findByTitle('Journal');
  expect(iframe).toHaveAttribute('src', 'https://relationship.example/?embedded=1&embedPath=%2Fjournal');

  // A location report from the child updates the shell URL, never the src.
  const event = new MessageEvent('message', {
    data: { source: 'tumbaland-app', type: 'app:location', app: 'relationship-front', path: '/activity-types' },
    origin: 'https://relationship.example'
  });
  Object.defineProperty(event, 'source', { value: (iframe as HTMLIFrameElement).contentWindow });
  window.dispatchEvent(event);

  await waitFor(() =>
    expect(screen.getByTitle('Journal')).toHaveAttribute(
      'src',
      'https://relationship.example/?embedded=1&embedPath=%2Fjournal'
    )
  );
});

it('hides the navigation from signed-out visitors', async () => {
  renderAt('/');
  await waitFor(() => expect(screen.getByText('page content')).toBeInTheDocument());
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Album' })).not.toBeInTheDocument();
});

it('shows the navigation once a session is confirmed', async () => {
  setSession(true);

  renderAt('/');

  expect(await screen.findByRole('link', { name: 'Album' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Money' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
});

it('puts the rail before the content on wide screens and the tab bar after it on phones', async () => {
  setSession(true);
  const { unmount } = renderAt('/');
  const rail = await screen.findByRole('navigation', { name: 'Main' });
  expect(rail.compareDocumentPosition(screen.getByText('page content'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  unmount();

  setMobile(true);
  renderAt('/');
  const tabBar = await screen.findByRole('navigation', { name: 'Main' });
  expect(tabBar.compareDocumentPosition(screen.getByText('page content'))).toBe(Node.DOCUMENT_POSITION_PRECEDING);
});

it('shows an unauthorized page instead of the iframe when not authenticated', async () => {
  const { authService } = await import('../services/authService');
  vi.mocked(authService.isAuthenticated).mockResolvedValueOnce(false);

  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
});
