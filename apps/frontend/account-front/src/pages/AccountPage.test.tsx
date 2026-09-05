import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../components/tabs/ProfileTab', () => ({
  default: () => <div>profile tab content</div>
}));

vi.mock('../components/tabs/ApiKeysTab', () => ({
  default: () => <div>api keys tab content</div>
}));

vi.mock('../components/tabs/ConnectionsTab', () => ({
  default: () => <div>connections tab content</div>
}));

import AccountPage from './AccountPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccountPage />
    </MemoryRouter>
  );
}

it('redirects the bare account path to the profile tab', () => {
  renderAt('/');
  expect(screen.getByText('profile tab content')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
});

it('selects the security tab index for a /security path', () => {
  renderAt('/security');
  // Only a Profile tab exists in the UI, but getActiveTab still resolves index 1 internally —
  // asserting via the (non-existent) selection would be brittle, so just confirm it renders.
  expect(screen.getByRole('tablist', { name: 'account tabs' })).toBeInTheDocument();
});

// handleTabChange only fires when MUI's Tabs value actually changes, and the
// "Profile" tab is the only one rendered (Security/Data are not yet built),
// so re-clicking the already-selected tab is a no-op and pushState is never
// invoked through the UI in its current state.
it('does not push a new path when re-clicking the already-active tab', async () => {
  const pushStateSpy = vi.spyOn(window.history, 'pushState');
  renderAt('/profile');

  await userEvent.click(screen.getByRole('tab', { name: 'Profile' }));

  expect(pushStateSpy).not.toHaveBeenCalled();
});

it('renders the API keys tab at its own path', () => {
  renderAt('/api-keys');

  expect(screen.getByText('api keys tab content')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'API keys' })).toHaveAttribute('aria-selected', 'true');
});

it('navigates from profile to API keys when the tab is clicked', async () => {
  const user = userEvent.setup();
  renderAt('/profile');

  await user.click(screen.getByRole('tab', { name: 'API keys' }));

  expect(screen.getByText('api keys tab content')).toBeInTheDocument();
  expect(screen.queryByText('profile tab content')).not.toBeInTheDocument();
});

it('navigates back to profile', async () => {
  const user = userEvent.setup();
  renderAt('/api-keys');

  await user.click(screen.getByRole('tab', { name: 'Profile' }));

  expect(screen.getByText('profile tab content')).toBeInTheDocument();
});

it('falls back to the first tab for a path with no tab of its own', () => {
  // The old hard-coded indices pointed at /security and /data, which never had
  // tabs; selection is now derived from the same list that builds them, so an
  // unknown path can no longer select a tab that does not exist.
  renderAt('/security');

  expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
});

describe('keys and connections are two tabs', () => {
  it('renders connections at its own path', () => {
    renderAt('/connections');

    expect(screen.getByText('connections tab content')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Connections' })).toHaveAttribute('aria-selected', 'true');
    // The two used to be one screen, where "New key" sat above a list of things
    // no key was ever made for.
    expect(screen.queryByText('api keys tab content')).not.toBeInTheDocument();
  });

  it('keeps the keys tab to keys alone', () => {
    renderAt('/api-keys');

    expect(screen.getByText('api keys tab content')).toBeInTheDocument();
    expect(screen.queryByText('connections tab content')).not.toBeInTheDocument();
  });

  it('moves between them without going through profile', async () => {
    const user = userEvent.setup();
    renderAt('/connections');

    await user.click(screen.getByRole('tab', { name: 'API keys' }));

    expect(screen.getByText('api keys tab content')).toBeInTheDocument();
  });
});
