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

it('redirects the index route to dashboard', async () => {
  renderAt('/');

  expect(await screen.findByText('dashboard page')).toBeInTheDocument();
});

it('renders the dashboard route', async () => {
  renderAt('/dashboard');

  expect(await screen.findByText('dashboard page')).toBeInTheDocument();
});

it('renders the albums route', async () => {
  renderAt('/albums');

  expect(await screen.findByText('albums page')).toBeInTheDocument();
});

it('renders the album detail route', async () => {
  renderAt('/albums/album-1');

  expect(await screen.findByText('album detail page')).toBeInTheDocument();
});

it('renders the photo detail route', async () => {
  renderAt('/albums/album-1/photos/photo-1');

  expect(await screen.findByText('photo detail page')).toBeInTheDocument();
});

it('renders the collage list route', async () => {
  renderAt('/collages');

  expect(await screen.findByText('collage list page')).toBeInTheDocument();
});

it('renders the collage details route', async () => {
  renderAt('/collages/collage-1');

  expect(await screen.findByText('collage details page')).toBeInTheDocument();
});
