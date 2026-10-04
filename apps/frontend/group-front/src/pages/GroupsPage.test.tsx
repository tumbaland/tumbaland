import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../components/tabs/GroupsTab', () => ({ default: () => <div>groups tab content</div> }));

import GroupsPage from './GroupsPage';

it('renders the groups list with no single-tab bar above it', () => {
  render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>
  );

  expect(screen.getByText('groups tab content')).toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});
