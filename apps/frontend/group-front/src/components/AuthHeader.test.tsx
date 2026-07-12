import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

let mockedIsMobile = false;
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/material')>();
  return { ...actual, useMediaQuery: () => mockedIsMobile };
});

vi.mock('../services/authService', () => ({
  authService: {
    checkAuth: vi.fn(),
    redirectToLogin: vi.fn(),
    logout: vi.fn()
  }
}));

import { authService } from '../services/authService';
import AuthHeader from './AuthHeader';

const mockedCheckAuth = authService.checkAuth as unknown as ReturnType<typeof vi.fn>;
const mockedRedirectToLogin = authService.redirectToLogin as unknown as ReturnType<typeof vi.fn>;
const mockedLogout = authService.logout as unknown as ReturnType<typeof vi.fn>;

function renderHeader() {
  return render(
    <MemoryRouter>
      <AuthHeader />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsMobile = false;
});

describe('desktop layout', () => {
  it('shows a spinner while the auth check is in flight', () => {
    mockedCheckAuth.mockReturnValue(new Promise(() => {}));
    renderHeader();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows a Login button when unauthenticated and redirects on click', async () => {
    mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
    renderHeader();

    const loginButton = await screen.findByRole('button', { name: /login/i });
    await userEvent.click(loginButton);
    expect(mockedRedirectToLogin).toHaveBeenCalled();
  });

  it('logs and still resolves to unauthenticated when the auth check throws', async () => {
    mockedCheckAuth.mockRejectedValue(new Error('down'));
    renderHeader();
    expect(await screen.findByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows the user name and an account menu with logout when authenticated', async () => {
    mockedCheckAuth.mockResolvedValue({ authenticated: true, user: { email: 'a@example.com', name: 'Alice' } });
    mockedLogout.mockResolvedValue(true);
    renderHeader();

    const accountButton = await screen.findByRole('button', { name: /alice/i });
    await userEvent.click(accountButton);

    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Logout'));

    expect(mockedLogout).toHaveBeenCalled();
  });

  it('navigates when a nav menu item is clicked', async () => {
    mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
    renderHeader();
    await screen.findByRole('button', { name: /login/i });

    await userEvent.click(screen.getByRole('button', { name: 'My Groups' }));
    expect(mockedNavigate).toHaveBeenCalledWith('/');
  });
});

describe('mobile layout', () => {
  beforeEach(() => {
    mockedIsMobile = true;
  });

  it('shows a spinner while loading', () => {
    mockedCheckAuth.mockReturnValue(new Promise(() => {}));
    renderHeader();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows a Login button when unauthenticated', async () => {
    mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
    renderHeader();
    expect(await screen.findByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows the account icon menu with the user email and logs out', async () => {
    mockedCheckAuth.mockResolvedValue({ authenticated: true, user: { email: 'a@example.com', name: 'Alice' } });
    mockedLogout.mockResolvedValue(true);
    renderHeader();

    const accountButton = await screen.findByRole('button', { name: /account menu/i });
    await userEvent.click(accountButton);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Logout'));

    expect(mockedLogout).toHaveBeenCalled();
  });

  it('shows an avatar image when the user has a picture', async () => {
    mockedCheckAuth.mockResolvedValue({
      authenticated: true,
      user: { email: 'a@example.com', name: 'Alice', picture: 'https://example.com/a.png' }
    });
    renderHeader();
    await screen.findByRole('button', { name: /account menu/i });

    const avatar = document.querySelector('img[src="https://example.com/a.png"]');
    expect(avatar).toBeInTheDocument();
  });

  it('opens the hamburger menu and navigates, closing the menu', async () => {
    mockedCheckAuth.mockResolvedValue({ authenticated: false, user: null });
    renderHeader();
    await screen.findByRole('button', { name: /login/i });

    const menuButtons = screen.getAllByRole('button');
    const hamburger = menuButtons.find((b) => b.querySelector('[data-testid="MenuIcon"]'))!;
    await userEvent.click(hamburger);

    await userEvent.click(await screen.findByText('My Groups'));

    expect(mockedNavigate).toHaveBeenCalledWith('/');
    await waitFor(() => expect(screen.queryByText('My Groups')).not.toBeInTheDocument());
  });
});
