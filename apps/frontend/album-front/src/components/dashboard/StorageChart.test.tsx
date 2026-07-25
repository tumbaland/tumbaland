import { render, screen } from '@testing-library/react';
import StorageChart from './StorageChart';

it('renders formatted total storage and average photo size', () => {
  render(<StorageChart totalStorage={1024 * 1024 * 5} averagePhotoSize={1024 * 500} />);

  expect(screen.getByText('5 MB')).toBeInTheDocument();
  expect(screen.getByText('500 KB')).toBeInTheDocument();
});

it('formats zero storage as "0 B"', () => {
  render(<StorageChart totalStorage={0} averagePhotoSize={0} />);

  expect(screen.getAllByText('0 B')).toHaveLength(2);
});

it('does not claim any fixed storage limit', () => {
  const oneHundredGB = 100 * 1024 * 1024 * 1024;
  render(<StorageChart totalStorage={oneHundredGB} averagePhotoSize={0} />);

  expect(screen.getByText('100 GB')).toBeInTheDocument();
  expect(screen.queryByText(/limit/i)).not.toBeInTheDocument();
});

it('renders nothing extra when there are no albums to break down', () => {
  render(<StorageChart totalStorage={1024} averagePhotoSize={0} />);

  expect(screen.queryByText('Largest albums')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it('renders the largest-albums breakdown, sized relative to the biggest album', () => {
  render(
    <StorageChart
      totalStorage={1024 * 1024 * 15}
      averagePhotoSize={1024 * 500}
      topAlbums={[
        { albumId: 'a1', name: 'Trip', totalSize: 1024 * 1024 * 10 },
        { albumId: 'a2', name: 'Wedding', totalSize: 1024 * 1024 * 5 }
      ]}
    />
  );

  expect(screen.getByText('Largest albums')).toBeInTheDocument();
  expect(screen.getByText('Trip')).toBeInTheDocument();
  expect(screen.getByText('Wedding')).toBeInTheDocument();
  expect(screen.getByText('10 MB')).toBeInTheDocument();

  const bars = screen.getAllByRole('progressbar');
  expect(bars[0]).toHaveAttribute('aria-valuenow', '100');
  expect(bars[1]).toHaveAttribute('aria-valuenow', '50');
});
