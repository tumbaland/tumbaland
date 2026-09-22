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

function renderNav(
  route: string,
  {
    mobile = false,
    who = user,
    unreadChat = 0,
    showMoney = false
  }: { mobile?: boolean; who?: User | null; unreadChat?: number; showMoney?: boolean } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppNav currentRoute={route} user={who} mobile={mobile} unreadChat={unreadChat} showMoney={showMoney} />
    </MemoryRouter>
  );
}

it('labels every module and marks the one in use', async () => {
  renderNav('/album/albums');

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(nav).toBeInTheDocument();
  for (const name of ['Home', 'Journal', 'Album']) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument();
  }
  expect(screen.getByRole('link', { name: 'Album' })).toHaveAttribute('aria-current', 'page');
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
  expect(screen.queryByRole('link', { name: /money/i })).not.toBeInTheDocument();
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

it('puts Chat in the middle of the phone tab bar, with the unread count', () => {
  renderNav('/', { mobile: true, unreadChat: 2 });

  const labels = screen.getAllByRole('link').map((link) => link.getAttribute('aria-label') ?? link.textContent);
  // With Account after it, Chat is the middle of five.
  expect(labels).toEqual(['Home', 'Journal', 'Chat, 2 unread', 'Album']);
  expect(screen.getByRole('link', { name: 'Chat, 2 unread' })).toHaveAttribute('href', '/chat');
});

it('marks Chat as current inside chat on a phone', () => {
  renderNav('/chat', { mobile: true });
  expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
});

it('keeps Chat out of the rail on a wider screen, where the header has it', () => {
  renderNav('/', { mobile: false });
  expect(screen.queryByRole('link', { name: /^Chat/ })).not.toBeInTheDocument();
});

it('leaves Money out of the menu by default', () => {
  renderNav('/', { mobile: true });
  expect(screen.queryByRole('link', { name: 'Money' })).not.toBeInTheDocument();
});

it('adds Money to the rail and the phone tab bar once turned on', () => {
  const { unmount } = renderNav('/finance/net-worth', { showMoney: true });
  expect(screen.getByRole('link', { name: 'Money' })).toHaveAttribute('aria-current', 'page');
  unmount();

  renderNav('/', { mobile: true, showMoney: true });
  const labels = screen.getAllByRole('link').map((link) => link.getAttribute('aria-label') ?? link.textContent);
  expect(labels).toEqual(['Home', 'Journal', 'Chat', 'Album', 'Money']);
});
