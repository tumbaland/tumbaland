import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('../services/authService', () => ({
  authService: { logout: vi.fn() }
}));

import { AppNav } from './AppNav';
import { User } from '../types';

const user: User = { id: 'u1', email: 'user@example.com', name: 'Jane Doe' };

function renderNav(route: string, { mobile = false, who = user }: { mobile?: boolean; who?: User | null } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppNav currentRoute={route} user={who} mobile={mobile} />
    </MemoryRouter>
  );
}

it('labels every module and marks the one in use', async () => {
  renderNav('/finance/net-worth');

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(nav).toBeInTheDocument();
  for (const name of ['Home', 'Journal', 'Album', 'Money']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument();
  }
  expect(screen.getByRole('link', { name: 'Money' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});

it('treats Home as current only on the home page itself', () => {
  renderNav('/');
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Album' })).not.toHaveAttribute('aria-current');
});

it('links each module to its route, so it can be opened in a new tab', () => {
  renderNav('/');
  expect(screen.getByRole('link', { name: 'Album' })).toHaveAttribute('href', '/album');
  expect(screen.getByRole('link', { name: 'Journal' })).toHaveAttribute('href', '/relationship');
  expect(screen.getByRole('link', { name: 'Money' })).toHaveAttribute('href', '/finance');
});

it('opens the account menu from the Account entry', async () => {
  renderNav('/');
  const account = screen.getByRole('button', { name: 'Account' });
  expect(account).toHaveAttribute('aria-haspopup', 'menu');

  await userEvent.click(account);

  expect(await screen.findByRole('menuitem', { name: 'Billing' })).toBeInTheDocument();
  expect(account).toHaveAttribute('aria-expanded', 'true');
});

it('shows the profile picture on the Account entry when there is one', () => {
  const { container } = renderNav('/', { who: { ...user, picture: 'https://example.com/me.png' } });
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/me.png');
});

it('offers the same entries as a tab bar on phones', async () => {
  renderNav('/album/albums', { mobile: true });

  expect(screen.getByRole('link', { name: 'Album' })).toHaveAttribute('aria-current', 'page');
  await userEvent.click(screen.getByRole('button', { name: 'Account' }));
  expect(await screen.findByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
});
