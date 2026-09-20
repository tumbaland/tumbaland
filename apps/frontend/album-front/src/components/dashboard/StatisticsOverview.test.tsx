import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import StatisticsOverview from './StatisticsOverview';

const data = {
  totalAlbums: 12,
  totalPhotos: 3456,
  totalStorage: 1024 * 1024 * 5,
  averagePhotoSize: 1024 * 500
};

const renderOverview = (overrides: Partial<typeof data> = {}) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<StatisticsOverview data={{ ...data, ...overrides }} />} />
        <Route path="/album/albums" element={<div>albums page</div>} />
      </Routes>
    </MemoryRouter>
  );

it('renders totals and titles for albums, photos, storage, and average size', () => {
  renderOverview();

  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText('Total Albums')).toBeInTheDocument();
  expect(screen.getByText('3,456')).toBeInTheDocument();
  expect(screen.getByText('Total Photos')).toBeInTheDocument();
  expect(screen.getByText('5 MB')).toBeInTheDocument();
  expect(screen.getByText('Storage Used')).toBeInTheDocument();
  expect(screen.getByText('500 KB')).toBeInTheDocument();
  expect(screen.getByText('Avg Photo Size')).toBeInTheDocument();
});

it('formats zero bytes as "0 B"', () => {
  renderOverview({ totalAlbums: 0, totalPhotos: 0, totalStorage: 0, averagePhotoSize: 0 });

  expect(screen.getAllByText('0 B')).toHaveLength(2);
});

it('opens the albums page when the albums card is activated', async () => {
  renderOverview();

  await userEvent.click(screen.getByRole('button', { name: /Total Albums: 12\. View albums/i }));

  expect(screen.getByText('albums page')).toBeInTheDocument();
});

it('leaves the other three figures as plain cards, having nowhere to send anyone', () => {
  renderOverview();

  // Only Albums is actionable, so it is the only button in the row.
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
