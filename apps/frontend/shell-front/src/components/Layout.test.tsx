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
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
});

it('renders children directly on the home route (no iframe, no footer)', () => {
  renderAt('/');
  expect(screen.getByText('page content')).toBeInTheDocument();
  expect(screen.queryByText('Status')).not.toBeInTheDocument();
});

it('renders children when the route has no configured app url', () => {
  renderAt('/relationship', {});
  expect(screen.getByText('page content')).toBeInTheDocument();
});

it('renders a protected iframe and hides the loader once it loads, with the footer visible', async () => {
  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  const iframe = await screen.findByTitle('Relationship');
  expect(iframe).toHaveAttribute('src', 'https://relationship.example/?embedded=1&embedPath=%2F');
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.getByText('Status')).toBeInTheDocument();

  iframe.dispatchEvent(new Event('load'));
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
});

it('boots the iframe on a nested route and keeps the src stable as the child navigates', async () => {
  renderAt('/relationship/journal', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  const iframe = await screen.findByTitle('Relationship');
  expect(iframe).toHaveAttribute('src', 'https://relationship.example/?embedded=1&embedPath=%2Fjournal');

  // A location report from the child updates the shell URL, never the src.
  const event = new MessageEvent('message', {
    data: { source: 'tumbaland-app', type: 'app:location', app: 'relationship-front', path: '/activity-types' },
    origin: 'https://relationship.example'
  });
  Object.defineProperty(event, 'source', { value: (iframe as HTMLIFrameElement).contentWindow });
  window.dispatchEvent(event);

  await waitFor(() =>
    expect(screen.getByTitle('Relationship')).toHaveAttribute(
      'src',
      'https://relationship.example/?embedded=1&embedPath=%2Fjournal'
    )
  );
});

it('shows an unauthorized page instead of the iframe when not authenticated', async () => {
  const { authService } = await import('../services/authService');
  vi.mocked(authService.isAuthenticated).mockResolvedValueOnce(false);

  renderAt('/relationship', { RELATIONSHIP_FRONT_URL: 'https://relationship.example' });

  expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
});
