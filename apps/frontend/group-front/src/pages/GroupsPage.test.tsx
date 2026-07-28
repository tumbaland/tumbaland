import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock('../components/tabs/GroupsTab', () => ({ default: () => <div>groups tab content</div> }));

import GroupsPage from './GroupsPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

it('renders the My Groups tab and its content', () => {
  renderPage();
  expect(screen.getByRole('tab', { name: 'My Groups' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('groups tab content')).toBeInTheDocument();
});

// handleTabChange only fires when MUI's Tabs value actually changes, and "My Groups"
// is the only tab rendered, so re-clicking it is a no-op and no navigation happens
// through the UI in its current single-tab state.
it('does not navigate when re-clicking the already-active tab', async () => {
  renderPage();

  await userEvent.click(screen.getByRole('tab', { name: 'My Groups' }));

  expect(mockedNavigate).not.toHaveBeenCalled();
});
