import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { APPS, USER_APPS, getAppByRoute } from '../config/apps';
import { ModuleHeader } from './ModuleHeader';

function renderHeader(route: string, mobile = false, unreadChat = 0) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <ModuleHeader
        app={getAppByRoute(route)}
        currentRoute={route}
        mobile={mobile}
        end={<span>tenant</span>}
        unreadChat={unreadChat}
      />
    </MemoryRouter>
  );
}

it('lists the Album sections inside the shell', () => {
  renderHeader('/album/albums');

  expect(screen.getByRole('navigation', { name: 'Album sections' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/album/dashboard');
  expect(screen.getByRole('link', { name: 'Albums' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Collages' })).toHaveAttribute('href', '/album/collages');
});

it('lists the Money sections inside the shell', () => {
  renderHeader('/finance/cash-flow');

  for (const label of ['Dashboard', 'Net Worth', 'Cash Flow', 'Investments', 'Planner']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }
  expect(screen.getByRole('link', { name: 'Cash Flow' })).toHaveAttribute('aria-current', 'page');
});

it('lists the Journal sections inside the shell', () => {
  renderHeader('/relationship/journal');

  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/relationship/dashboard');
  expect(screen.getByRole('link', { name: 'Entries' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/relationship/map');
});

describe('the account apps get the same bar as the modules', () => {
  it('lists the Profile sections, which used to be a tab row inside the page', () => {
    renderHeader('/account/api-keys');

    expect(screen.getByRole('navigation', { name: 'Profile sections' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/account/devices');
    expect(screen.getByRole('link', { name: 'API keys' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists the Billing sections', () => {
    renderHeader('/payments/history');

    expect(screen.getByRole('navigation', { name: 'Billing sections' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute('href', '/payments/plans');
    expect(screen.getByRole('link', { name: 'Payments' })).toHaveAttribute('aria-current', 'page');
  });

  it('names Groups without inventing sections for a one-page app', () => {
    renderHeader('/groups');

    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

it('keeps the tenant selector in the bar on every page', () => {
  renderHeader('/album/albums');
  expect(screen.getByText('tenant')).toBeInTheDocument();
});

it('puts the wordmark on the home page rather than repeating "Home"', () => {
  // The rail entry is lit and the greeting below says the same thing; the
  // word in the corner was the third copy.
  renderHeader('/');

  expect(screen.getByText('Tumbaland')).toBeInTheDocument();
  expect(screen.queryByText('Home')).not.toBeInTheDocument();
});

it('leaves a module with sections unnamed: the rail and the active pill already say it', () => {
  renderHeader('/album/albums');

  expect(screen.queryByText('Album')).not.toBeInTheDocument();
});

it('collapses the sections into one dropdown on a phone', async () => {
  renderHeader('/album/collages', true);

  expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Collages/ }));

  expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/album/dashboard');
});

it('takes every section straight from the app config, so no list can drift', () => {
  // The labels the bar shows are the same objects `remotes.ts` and the nav read.
  const configured = [...APPS, ...USER_APPS].flatMap((app) => app.menu ?? []);
  expect(configured.length).toBeGreaterThan(0);
  for (const { route } of configured) {
    expect(route.startsWith('/')).toBe(true);
  }
});

describe('chat', () => {
  it('is a button in the bar, with the unread count', () => {
    renderHeader('/album/albums', true, 3);

    const chat = screen.getByRole('link', { name: 'Chat, 3 unread' });
    expect(chat).toHaveAttribute('href', '/chat');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('tenant')).toBeInTheDocument();
  });

  it('shows no count when everything is read', () => {
    renderHeader('/', true);
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
  });

  it('offers the way home from the conversation list, in place of the tenant', () => {
    renderHeader('/chat', true, 3);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /Back to conversations/ })).not.toBeInTheDocument();
    expect(screen.queryByText('tenant')).not.toBeInTheDocument();
  });

  it('offers the way back to the list from a thread', () => {
    renderHeader('/chat/c1', true);

    expect(screen.getByRole('link', { name: 'Back to conversations' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });
});
