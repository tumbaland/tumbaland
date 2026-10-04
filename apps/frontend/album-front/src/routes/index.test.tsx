import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { vi } from 'vite-plus/test';
import AppRoutes from './index';

vi.mock('../pages/DashboardPage', () => ({ default: () => <div>dashboard page</div> }));
vi.mock('../pages/AlbumsPage', () => ({ default: () => <div>albums page</div> }));
vi.mock('../pages/AlbumDetailPage', () => ({ default: () => <div>album detail page</div> }));
vi.mock('../pages/PhotoDetailPage', () => ({ default: () => <div>photo detail page</div> }));
vi.mock('../pages/CollageListPage', () => ({ default: () => <div>collage list page</div> }));
vi.mock('../pages/CollageDetailsPage', () => ({ default: () => <div>collage details page</div> }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </MemoryRouter>
  );
}

it('redirects the index route to dashboard', () => {
  renderAt('/');

  expect(screen.getByText('dashboard page')).toBeInTheDocument();
});

it('renders the dashboard route', () => {
  renderAt('/dashboard');

  expect(screen.getByText('dashboard page')).toBeInTheDocument();
});

it('renders the albums route', () => {
  renderAt('/albums');

  expect(screen.getByText('albums page')).toBeInTheDocument();
});

it('renders the album detail route', () => {
  renderAt('/albums/album-1');

  expect(screen.getByText('album detail page')).toBeInTheDocument();
});

it('renders the photo detail route', () => {
  renderAt('/albums/album-1/photos/photo-1');

  expect(screen.getByText('photo detail page')).toBeInTheDocument();
});

it('renders the collage list route', () => {
  renderAt('/collages');

  expect(screen.getByText('collage list page')).toBeInTheDocument();
});

it('renders the collage details route', () => {
  renderAt('/collages/collage-1');

  expect(screen.getByText('collage details page')).toBeInTheDocument();
});
