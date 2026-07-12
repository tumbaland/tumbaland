import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Person } from '@mui/icons-material';
import { AccountMenu } from './AccountMenu';
import { User } from '../types';

const user: User = { id: 'u1', email: 'user@example.com', name: 'Jane Doe' };

it('renders nothing when there is no user', () => {
  const { container } = render(
    <MemoryRouter>
      <AccountMenu user={null} anchorEl={null} onMenuOpen={vi.fn()} onMenuClose={vi.fn()} onLogout={vi.fn()} />
    </MemoryRouter>
  );
  expect(container).toBeEmptyDOMElement();
});

it('shows an account-circle icon when the user has no picture', () => {
  render(
    <MemoryRouter>
      <AccountMenu user={user} anchorEl={null} onMenuOpen={vi.fn()} onMenuClose={vi.fn()} onLogout={vi.fn()} />
    </MemoryRouter>
  );
  expect(screen.getByTestId('AccountCircleIcon')).toBeInTheDocument();
});

it('shows the user avatar image when a picture is set', () => {
  render(
    <MemoryRouter>
      <AccountMenu
        user={{ ...user, picture: 'https://example.com/pic.png' }}
        anchorEl={null}
        onMenuOpen={vi.fn()}
        onMenuClose={vi.fn()}
        onLogout={vi.fn()}
      />
    </MemoryRouter>
  );
  expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute('src', 'https://example.com/pic.png');
});

it('opens the menu, shows user info and navigation items, and navigates on click', async () => {
  const onMenuOpen = vi.fn();
  const onMenuClose = vi.fn();
  const anchorEl = document.createElement('div');
  render(
    <MemoryRouter>
      <AccountMenu
        user={user}
        anchorEl={anchorEl}
        onMenuOpen={onMenuOpen}
        onMenuClose={onMenuClose}
        onLogout={vi.fn()}
        navigationItems={[{ key: 'account', label: 'Account', route: '/account', icon: Person }]}
      />
    </MemoryRouter>
  );

  expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  expect(screen.getByText('user@example.com')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Account'));
  expect(onMenuClose).toHaveBeenCalled();
});

it('calls onLogout when the Logout item is clicked', async () => {
  const onLogout = vi.fn();
  const anchorEl = document.createElement('div');
  render(
    <MemoryRouter>
      <AccountMenu user={user} anchorEl={anchorEl} onMenuOpen={vi.fn()} onMenuClose={vi.fn()} onLogout={onLogout} />
    </MemoryRouter>
  );

  await userEvent.click(screen.getByText('Logout'));
  expect(onLogout).toHaveBeenCalled();
});

it('calls onMenuOpen when the icon button is clicked', async () => {
  const onMenuOpen = vi.fn();
  render(
    <MemoryRouter>
      <AccountMenu user={user} anchorEl={null} onMenuOpen={onMenuOpen} onMenuClose={vi.fn()} onLogout={vi.fn()} />
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole('button', { name: 'account menu' }));
  expect(onMenuOpen).toHaveBeenCalled();
});
