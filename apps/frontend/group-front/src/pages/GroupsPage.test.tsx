import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../components/tabs/GroupsTab', () => ({ default: () => <div>groups tab content</div> }));

import GroupsPage from './GroupsPage';

it('renders the My Groups tab and its content', () => {
  render(<GroupsPage />);
  expect(screen.getByRole('tab', { name: 'My Groups' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('groups tab content')).toBeInTheDocument();
});

// handleTabChange only fires when MUI's Tabs value actually changes, and "My Groups"
// is the only tab rendered, so re-clicking it is a no-op and pushState never fires
// through the UI in its current single-tab state.
it('does not push a new path when re-clicking the already-active tab', async () => {
  const pushStateSpy = vi.spyOn(window.history, 'pushState');
  render(<GroupsPage />);

  await userEvent.click(screen.getByRole('tab', { name: 'My Groups' }));

  expect(pushStateSpy).not.toHaveBeenCalled();
});
