import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('../services/authService', () => ({
  authService: { isAuthenticated: vi.fn().mockResolvedValue(true), redirectToLogin: vi.fn(), checkAuth: vi.fn() }
}));
vi.mock('../pages/OverviewPage', () => ({ default: () => <div>overview page</div> }));
vi.mock('../pages/UsersPage', () => ({ default: () => <div>users page</div> }));
vi.mock('../pages/UserDetailPage', () => ({ default: () => <div>user page</div> }));
vi.mock('../pages/AssistantsPage', () => ({ default: () => <div>assistants page</div> }));
vi.mock('../pages/DeletionsPage', () => ({ default: () => <div>deletions page</div> }));

import AppRoutes from './index';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AppRoutes />} />
      </Routes>
    </MemoryRouter>
  );

describe('routes', () => {
  it.each([
    ['/admin/overview', 'overview page'],
    ['/admin/users', 'users page'],
    ['/admin/users/u1', 'user page'],
    ['/admin/assistants', 'assistants page'],
    ['/admin/deletions', 'deletions page']
  ])('%s shows the %s', async (path, text) => {
    renderAt(path);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('opens on the overview', async () => {
    renderAt('/admin');
    expect(await screen.findByText('overview page')).toBeInTheDocument();
  });

  it('sends an address it does not know to the overview', async () => {
    renderAt('/admin/nonsense');
    expect(await screen.findByText('overview page')).toBeInTheDocument();
  });
});
