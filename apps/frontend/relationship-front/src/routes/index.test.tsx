import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../pages/Dashboard', () => ({ default: () => <div>Dashboard page</div> }));
vi.mock('../pages/JournalPage', () => ({ default: () => <div>Journal page</div> }));

import AppRoutes from './index';

// Mounted the way both App and the shell mount it: under the app's own prefix.
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/relationship/*" element={<AppRoutes />} />
      </Routes>
    </MemoryRouter>
  );

it('sends the old map address to the dashboard, which now holds the map', () => {
  renderAt('/relationship/map');

  expect(screen.getByText('Dashboard page')).toBeInTheDocument();
});
