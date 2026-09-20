import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/statistics', () => ({
  getMonthlyStatistics: vi.fn()
}));

import { getMonthlyStatistics } from '../services/statistics';
import TotalDaysChart from './TotalDaysChart';
import { ActivityType } from '../services/types';

const mockedGetMonthlyStatistics = getMonthlyStatistics as unknown as ReturnType<typeof vi.fn>;

const featuredType: ActivityType = {
  _id: 't1', id: 't1', name: 'Reading', slug: 'reading', color: '#111',
  isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1'
};

beforeEach(() => vi.clearAllMocks());

it('shows a spinner while loading', () => {
  mockedGetMonthlyStatistics.mockReturnValue(new Promise(() => {}));
  render(<TotalDaysChart />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedGetMonthlyStatistics.mockRejectedValue(new Error('boom'));
  render(<TotalDaysChart />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows an empty state when there is no data', async () => {
  mockedGetMonthlyStatistics.mockResolvedValue([]);
  render(<TotalDaysChart />);
  expect(await screen.findByText('No data available')).toBeInTheDocument();
});

it('renders together/apart segments without a featured type', async () => {
  // January 2024 has 31 calendar days; 10 of them had an entry.
  mockedGetMonthlyStatistics.mockResolvedValue([
    { month: '1', year: 2024, totalDays: 31, daysWithEntries: 10, types: [] }
  ]);

  render(<TotalDaysChart title="My Chart" />);

  await waitFor(() => expect(screen.getByText('My Chart')).toBeInTheDocument());
  expect(screen.getByText('Days together (10)')).toBeInTheDocument();
  expect(screen.getByText('Days apart (21)')).toBeInTheDocument();
  expect(screen.queryByText(/days \(/)).not.toBeInTheDocument(); // no featured-type chip
});

it('splits out the featured type\'s days into its own segment', async () => {
  mockedGetMonthlyStatistics.mockResolvedValue([
    { month: '1', year: 2024, totalDays: 31, daysWithEntries: 10, types: [{ slug: 'reading', count: 5, uniqueDays: 4 }] }
  ]);

  render(<TotalDaysChart featuredType={featuredType} />);

  expect(await screen.findByText('Reading days (4)')).toBeInTheDocument();
  expect(screen.getByText('Other days together (6)')).toBeInTheDocument();
  expect(screen.getByText('Days apart (21)')).toBeInTheDocument();
});

it('changes the selected year, refetching data', async () => {
  mockedGetMonthlyStatistics.mockResolvedValue([
    { month: '1', year: 2024, totalDays: 31, daysWithEntries: 1, types: [] }
  ]);
  render(<TotalDaysChart year={2024} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('2024'));

  const yearLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Year')!;
  const combobox = yearLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
  await userEvent.click(await screen.findByRole('option', { name: 'All Years' }));

  expect(mockedGetMonthlyStatistics).toHaveBeenCalledWith(undefined, 'g1');
});
