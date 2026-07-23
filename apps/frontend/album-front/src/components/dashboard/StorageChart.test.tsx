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

it('computes usage percentage against the 10GB limit', () => {
  const oneGB = 1024 * 1024 * 1024;
  render(<StorageChart totalStorage={oneGB} averagePhotoSize={0} />);

  expect(screen.getByText('10.0% of 10GB limit')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
});

it('caps the usage percentage at 100% when storage exceeds the limit', () => {
  const twentyGB = 20 * 1024 * 1024 * 1024;
  render(<StorageChart totalStorage={twentyGB} averagePhotoSize={0} />);

  expect(screen.getByText('100.0% of 10GB limit')).toBeInTheDocument();
});
