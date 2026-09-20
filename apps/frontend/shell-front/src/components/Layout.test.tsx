import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';
import { vi } from 'vitest';

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn().mockResolvedValue({ authenticated: false, user: null }),
    isAuthenticated: vi.fn().mockResolvedValue(true),
    redirectToLogin: vi.fn(),
    logout: vi.fn()
  }
}));

vi.mock('./RemoteOutlet', () => ({
  RemoteOutlet: () => <div>remote module</div>
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

it('renders its own children on the home route, with no module loaded', () => {
  renderAt('/');
  expect(screen.getByText('page content')).toBeInTheDocument();
  expect(screen.queryByText('remote module')).not.toBeInTheDocument();
});

it('renders the module that owns the path, behind the session gate', async () => {
  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  expect(await screen.findByText('remote module')).toBeInTheDocument();
  expect(screen.queryByText('page content')).not.toBeInTheDocument();
});

it('renders the module on a nested route too — its own routes match the rest', async () => {
  renderAt('/relationship/journal', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  expect(await screen.findByText('remote module')).toBeInTheDocument();
});

it('keeps no iframe anywhere: a module is code in this page now', async () => {
  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  await screen.findByText('remote module');
  // An iframe threw the module's JS context away on every switch, which is
  // what made each visit re-check the session and re-fetch its data.
  expect(document.querySelector('iframe')).toBeNull();
});

it('leaves the navigation mounted while the module under it changes', async () => {
  setSession(true);
  function Go({ to }: { to: string }) {
    const navigate = useNavigate();
    return <button onClick={() => navigate(to)}>go {to}</button>;
  }
  const user = userEvent.setup();
  render(
    <ConfigContext.Provider
      value={
        {
          RELATIONSHIP_FRONT_URL: 'https://relationship.example',
          ALBUM_FRONT_URL: 'https://album.example'
        } as any
      }
    >
      <MemoryRouter initialEntries={['/relationship']}>
        <Layout>
          <div>page content</div>
        </Layout>
        <Go to="/album" />
      </MemoryRouter>
    </ConfigContext.Provider>
  );

  const nav = await screen.findByRole('navigation', { name: 'Main' });
  await screen.findByText('remote module');

  await user.click(screen.getByRole('button', { name: 'go /album' }));

  // The same nav element, not a replacement: crossing modules no longer tears
  // down and rebuilds the chrome around them.
  await waitFor(() => expect(screen.getByText('remote module')).toBeInTheDocument());
  expect(screen.getByRole('navigation', { name: 'Main' })).toBe(nav);
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

it('shows an unauthorized page instead of the module when not authenticated', async () => {
  const { authService } = await import('../services/authService');
  vi.mocked(authService.isAuthenticated).mockResolvedValueOnce(false);

  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
});

it('gives every module the same content width, rather than leaving it to each one', async () => {
  // Album capped its own pages and centred them; Journal and Money ran to the
  // edge of the window, so crossing between them moved the content sideways.
  setSession(true);
  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  const module = await screen.findByText('remote module');
  const column = module.parentElement as HTMLElement;

  expect(column.style.maxWidth).toBe('1536px');
  expect(column.style.marginInline).toBe('auto');
});

it("leaves the shell's own pages to set their own width", async () => {
  // The home page is a full-bleed backdrop with a narrow column floated on
  // top; capping it here cropped the image to a band down the middle.
  setSession(true);
  renderAt('/');

  const content = (await screen.findByText('page content')).parentElement as HTMLElement;

  expect(content.style.maxWidth).toBe('');
  expect(content.style.marginInline).toBe('');
});
