import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthHeader, AuthHeaderProps, AuthHeaderTenantOption, AuthHeaderTenantSelectorProps } from './AuthHeader';

// vi.mock factories are hoisted above imports, so the mutable state they close
// over has to be created through vi.hoisted rather than a plain module-level let.
const { mediaQueryState, mockNavigate } = vi.hoisted(() => ({
  mediaQueryState: { isMobile: false },
  mockNavigate: vi.fn()
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// useLocation is left real (driven by the MemoryRouter below); only useMediaQuery
// is swapped out so mobile/desktop branching can be pinned per-test instead of
// depending on jsdom's (nonexistent) real breakpoint behavior.
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/material')>();
  return {
    ...actual,
    useMediaQuery: () => mediaQueryState.isMobile
  };
});

function TenantSelectorStub({ selectedTenant, tenants, loading, error }: AuthHeaderTenantSelectorProps) {
  return (
    <div data-testid="tenant-selector">
      selected:{selectedTenant?.name ?? 'none'}|count:{tenants.length}|loading:{String(Boolean(loading))}|error:
      {error ?? 'none'}
    </div>
  );
}

const baseProps: AuthHeaderProps = {
  isLoading: false,
  isAuthenticated: false,
  user: null,
  onLogin: vi.fn(),
  onLogout: vi.fn(),
  navigationItems: [
    { label: 'Home', path: '/' },
    { label: 'Albums', path: '/albums' }
  ],
  shellFrontUrl: 'https://shell.example',
  TenantSelectorComponent: TenantSelectorStub,
  selectedTenant: null,
  availableTenants: [],
  onTenantChange: vi.fn()
};

function renderAuthHeader(props: Partial<AuthHeaderProps> = {}, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthHeader {...baseProps} {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mediaQueryState.isMobile = false;
  mockNavigate.mockClear();
});

describe('AuthHeader', () => {
  describe('loading state', () => {
    it('renders a spinner and not the login/account UI', () => {
      renderAuthHeader({ isLoading: true });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByTestId('LoginIcon')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    });
  });

  describe('unauthenticated state', () => {
    it('renders the LoginButton and calls onLogin when clicked', async () => {
      const onLogin = vi.fn();
      const user = userEvent.setup();
      renderAuthHeader({ isAuthenticated: false, user: null, onLogin });

      const loginButton = screen.getByTestId('LoginIcon').closest('button');
      expect(loginButton).not.toBeNull();

      await user.click(loginButton!);

      expect(onLogin).toHaveBeenCalledTimes(1);
    });

    it('does not render the account menu or tenant selector', () => {
      renderAuthHeader({ isAuthenticated: false, user: null });

      expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('tenant-selector')).not.toBeInTheDocument();
    });
  });

  describe('authenticated state', () => {
    const user = { name: 'Ada Lovelace', email: 'ada@example.com' };

    it("shows the user's name and email in the account menu", async () => {
      const userEventInstance = userEvent.setup();
      renderAuthHeader({ isAuthenticated: true, user });

      await userEventInstance.click(screen.getByRole('button', { name: /account menu/i }));

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    it('renders the avatar image when a picture URL is provided', () => {
      renderAuthHeader({
        isAuthenticated: true,
        user: { ...user, picture: 'https://example.com/avatar.png' }
      });

      const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('falls back to a generic account icon when no picture is provided', () => {
      renderAuthHeader({ isAuthenticated: true, user });

      expect(screen.getByTestId('AccountCircleIcon')).toBeInTheDocument();
    });

    it('calls onLogout and closes the menu on logout', async () => {
      const onLogout = vi.fn().mockResolvedValue(undefined);
      const userEventInstance = userEvent.setup();
      renderAuthHeader({ isAuthenticated: true, user, onLogout });

      await userEventInstance.click(screen.getByRole('button', { name: /account menu/i }));
      expect(await screen.findByText('ada@example.com')).toBeInTheDocument();

      await userEventInstance.click(screen.getByRole('menuitem', { name: /logout/i }));

      expect(onLogout).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
      });
    });

    it.each([
      ['profile', 'account'],
      ['groups', 'groups'],
      ['billing', 'payments']
    ])('navigates window.top to the shell-front %s page from the account menu', async (menuItemName, path) => {
      const userEventInstance = userEvent.setup();
      renderAuthHeader({ isAuthenticated: true, user });
      // jsdom's window.top === window by default; stub location the same way
      // the other suites do to avoid jsdom's "Not implemented: navigation".
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: '' } });

      await userEventInstance.click(screen.getByRole('button', { name: /account menu/i }));
      await userEventInstance.click(await screen.findByRole('menuitem', { name: new RegExp(menuItemName, 'i') }));

      expect(window.location.href).toBe(`https://shell.example/${path}`);
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
    });

    it('renders the injected tenant selector with forwarded props', () => {
      const tenants: AuthHeaderTenantOption[] = [{ id: '1', name: 'Personal', type: 'personal', isSelected: true }];
      renderAuthHeader({
        isAuthenticated: true,
        user,
        selectedTenant: tenants[0],
        availableTenants: tenants,
        tenantsLoading: true,
        tenantsError: 'boom'
      });

      const selector = screen.getByTestId('tenant-selector');
      expect(selector).toHaveTextContent('selected:Personal');
      expect(selector).toHaveTextContent('count:1');
      expect(selector).toHaveTextContent('loading:true');
      expect(selector).toHaveTextContent('error:boom');
    });
  });

  describe('navigation (desktop layout)', () => {
    it('renders each navigation item and calls navigate on click', async () => {
      const userEventInstance = userEvent.setup();
      renderAuthHeader();

      expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
      const albumsButton = screen.getByRole('button', { name: 'Albums' });

      await userEventInstance.click(albumsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/albums');
    });
  });

  describe('mobile layout', () => {
    it('collapses navigation into a single dropdown labelled with the active route', () => {
      mediaQueryState.isMobile = true;
      renderAuthHeader({}, '/albums');

      expect(screen.getByRole('button', { name: /albums/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    });

    it('reveals nav items in a menu when opening the dropdown, and navigates on selection', async () => {
      mediaQueryState.isMobile = true;
      const userEventInstance = userEvent.setup();
      renderAuthHeader();

      await userEventInstance.click(screen.getByRole('button', { name: /home/i }));
      const albumsItem = await screen.findByRole('menuitem', { name: 'Albums' });

      await userEventInstance.click(albumsItem);

      expect(mockNavigate).toHaveBeenCalledWith('/albums');
    });

    it('renders the tenant selector inline (not just in the desktop layout) when authenticated', () => {
      mediaQueryState.isMobile = true;
      renderAuthHeader({
        isAuthenticated: true,
        user: { name: 'Ada Lovelace', email: 'ada@example.com' }
      });

      expect(screen.getByTestId('tenant-selector')).toBeInTheDocument();
    });
  });

  describe('navigation items with icons', () => {
    function IconStub() {
      return <span data-testid="nav-icon" />;
    }

    it('renders the icon next to each desktop nav button', () => {
      renderAuthHeader({ navigationItems: [{ label: 'Home', path: '/', icon: IconStub }] });

      expect(screen.getAllByTestId('nav-icon').length).toBeGreaterThan(0);
    });

    it('renders the icon next to each item in the mobile nav dropdown', async () => {
      mediaQueryState.isMobile = true;
      const userEventInstance = userEvent.setup();
      renderAuthHeader({
        navigationItems: [
          { label: 'Home', path: '/', icon: IconStub },
          { label: 'Albums', path: '/albums' }
        ]
      });

      await userEventInstance.click(screen.getByRole('button', { name: /home/i }));
      await screen.findByRole('menuitem', { name: 'Albums' });

      expect(screen.getAllByTestId('nav-icon').length).toBeGreaterThan(0);
    });
  });
});
