import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

let mockedIsMobile = false;
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/material')>();
  return { ...actual, useMediaQuery: () => mockedIsMobile };
});

import TimeSeriesChart from './TimeSeriesChart';

beforeEach(() => {
  mockedIsMobile = false;
});

it('renders the section title', () => {
  render(
    <TimeSeriesChart
      albumsData={[{ date: '2024-01-01', count: 2 }]}
      photosData={[{ date: '2024-01-01', count: 5 }]}
    />
  );

  expect(screen.getByText('Activity Over Time')).toBeInTheDocument();
});

it('renders without crashing when the two series cover different dates', () => {
  render(
    <TimeSeriesChart
      albumsData={[{ date: '2024-01-01', count: 2 }, { date: '2024-02-01', count: 1 }]}
      photosData={[{ date: '2024-01-15', count: 9 }]}
    />
  );

  expect(screen.getByText('Activity Over Time')).toBeInTheDocument();
});

it('renders on mobile without crashing (narrower tick-label logic)', () => {
  mockedIsMobile = true;
  render(
    <TimeSeriesChart
      albumsData={[
        { date: '2024-01-01', count: 1 },
        { date: '2024-02-01', count: 2 },
        { date: '2024-03-01', count: 3 },
        { date: '2024-04-01', count: 4 }
      ]}
      photosData={[]}
    />
  );

  expect(screen.getByText('Activity Over Time')).toBeInTheDocument();
});

it('renders with empty data for both series', () => {
  render(<TimeSeriesChart albumsData={[]} photosData={[]} />);

  expect(screen.getByText('Activity Over Time')).toBeInTheDocument();
});
