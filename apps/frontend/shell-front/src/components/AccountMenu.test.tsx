import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../services/pushNotifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/pushNotifications')>()),
  forgetDeviceOnServer: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../services/authService', () => ({
  authService: { logout: vi.fn() }
}));

import { authService } from '../services/authService';
import { forgetDeviceOnServer } from '../services/pushNotifications';
import { APP_VERSION } from '../config/releaseNotes';
import { AccountMenu } from './AccountMenu';
import { User } from '../types';

const user: User = { id: 'u1', email: 'user@example.com', name: 'Jane Doe' };

function CurrentPath() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderMenu({
  route = '/finance',
  mobile = false,
  open = true,
  whatsNewUnseen = false
}: { route?: string; mobile?: boolean; open?: boolean; whatsNewUnseen?: boolean } = {}) {
  const onClose = vi.fn();
  const onOpenWhatsNew = vi.fn();
  const anchorEl = open ? document.body.appendChild(document.createElement('button')) : null;
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={<CurrentPath />} />
      </Routes>
      <AccountMenu
        user={user}
        anchorEl={anchorEl}
        currentRoute={route}
        mobile={mobile}
        onClose={onClose}
        onOpenWhatsNew={onOpenWhatsNew}
        whatsNewUnseen={whatsNewUnseen}
      />
    </MemoryRouter>
  );
  return { onClose, onOpenWhatsNew };
}

beforeEach(() => vi.clearAllMocks());

it('renders nothing while closed', () => {
  renderMenu({ open: false });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('shows who is signed in, the account pages, appearance and sign out, and nothing else', () => {
  renderMenu();

  expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();
  expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  expect(screen.getByText('user@example.com')).toBeInTheDocument();
  const actions = screen
    .getAllByRole('menuitem')
    .filter((item) => item.getAttribute('aria-disabled') !== 'true')
    .map((item) => item.textContent);
  expect(actions).toEqual(['Profile', 'Groups', 'Billing', 'AutoLightDark', `What's new${APP_VERSION}`, 'Sign out']);
});

it('lists no Billing inside a native app, where store billing rules apply', () => {
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
  try {
    renderMenu();

    const actions = screen
      .getAllByRole('menuitem')
      .filter((item) => item.getAttribute('aria-disabled') !== 'true')
      .map((item) => item.textContent);
    expect(actions).toEqual(['Profile', 'Groups', 'AutoLightDark', `What's new${APP_VERSION}`, 'Sign out']);
  } finally {
    delete window.Capacitor;
  }
});

it("closes, then opens what's new, from the version row", async () => {
  const { onClose, onOpenWhatsNew } = renderMenu();

  await userEvent.click(screen.getByRole('menuitem', { name: `What's new, version ${APP_VERSION}` }));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onOpenWhatsNew).toHaveBeenCalledTimes(1);
});

it('says in the row when there are changes not yet looked at', () => {
  renderMenu({ whatsNewUnseen: true });
  expect(
    screen.getByRole('menuitem', { name: `What's new, version ${APP_VERSION}, has changes you have not seen` })
  ).toBeInTheDocument();
});

it('marks the account page the user is on', () => {
  renderMenu({ route: '/payments/plans' });
  expect(screen.getByRole('menuitem', { name: 'Billing' })).toHaveClass('Mui-selected');
  expect(screen.getByRole('menuitem', { name: 'Profile' })).not.toHaveClass('Mui-selected');
});

it('navigates to an account page and closes', async () => {
  const { onClose } = renderMenu();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Groups' }));

  expect(screen.getByTestId('path')).toHaveTextContent('/groups');
  expect(onClose).toHaveBeenCalled();
});

it('signs out from the home route', async () => {
  vi.mocked(authService.logout).mockResolvedValue(true);
  const { onClose } = renderMenu();

  await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

  await waitFor(() => expect(authService.logout).toHaveBeenCalled());
  // Before the session goes, or the server would refuse to forget the device.
  expect(vi.mocked(forgetDeviceOnServer).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(authService.logout).mock.invocationCallOrder[0]!
  );
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
  expect(onClose).toHaveBeenCalled();
});

it('opens as a bottom sheet on phones with the same entries', () => {
  renderMenu({ mobile: true });

  expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
  expect(document.querySelector('.MuiDrawer-root')).not.toBeNull();
  expect(document.querySelector('.MuiPopover-root')).toBeNull();
});

it('holds no money switch or entry: those live under Profile > Features and the main menu', () => {
  renderMenu({ route: '/' });
  expect(screen.queryByText(/money/i)).not.toBeInTheDocument();
});

it('puts the appearance buttons above message notifications', () => {
  renderMenu();

  const rows = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
  const appearance = rows.findIndex((text) => text.includes('Auto'));
  const notifications = rows.findIndex((text) => text.includes('Message notifications'));
  expect(appearance).toBeGreaterThan(-1);
  expect(appearance).toBeLessThan(notifications);
});
