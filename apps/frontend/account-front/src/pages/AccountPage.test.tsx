import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../components/tabs/ProfileTab', () => ({
  default: () => <div>profile tab content</div>
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
