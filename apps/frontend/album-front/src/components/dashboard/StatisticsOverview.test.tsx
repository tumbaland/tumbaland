import { render, screen } from '@testing-library/react';
import StatisticsOverview from './StatisticsOverview';

it('renders totals and titles for albums, photos, storage, and average size', () => {
  render(
    <StatisticsOverview
      data={{ totalAlbums: 12, totalPhotos: 3456, totalStorage: 1024 * 1024 * 5, averagePhotoSize: 1024 * 500 }}
    />
  );

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
  render(<StatisticsOverview data={{ totalAlbums: 0, totalPhotos: 0, totalStorage: 0, averagePhotoSize: 0 }} />);

  expect(screen.getAllByText('0 B')).toHaveLength(2);
});
