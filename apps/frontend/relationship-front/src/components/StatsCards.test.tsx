import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../hooks/useStatistics', () => ({ useStatistics: vi.fn() }));

import { useStatistics } from '../hooks/useStatistics';
import StatsCards from './StatsCards';

const mockedUseStatistics = useStatistics as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

it('shows a spinner while loading', () => {
  mockedUseStatistics.mockReturnValue({ statistics: null, loading: true, error: null });
  render(<StatsCards highlightTypeIds={[]} />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the query fails', () => {
  mockedUseStatistics.mockReturnValue({ statistics: null, loading: false, error: 'boom' });
  render(<StatsCards highlightTypeIds={[]} />);
  expect(screen.getByText(/error loading statistics: boom/i)).toBeInTheDocument();
});

it('shows a warning when there are no statistics', () => {
  mockedUseStatistics.mockReturnValue({ statistics: null, loading: false, error: null });
  render(<StatsCards highlightTypeIds={[]} />);
  expect(screen.getByText(/no statistics available/i)).toBeInTheDocument();
});

it('renders base cards plus a card per highlighted type, with a formatted first-entry date', () => {
  mockedUseStatistics.mockReturnValue({
    statistics: {
      totalHours: 42,
      totalActivities: 10,
      firstEntryDate: '2024-01-15',
      daysSinceFirstEntry: 100,
      types: [{ typeId: 't1', slug: 'reading', name: 'Reading', color: '#111', count: 5, totalHours: 10, uniqueDays: 4 }]
    },
    loading: false,
    error: null
  });

  render(<StatsCards highlightTypeIds={['t1']} />);

  expect(screen.getByText('Days')).toBeInTheDocument();
  expect(screen.getByText('Total Hours')).toBeInTheDocument();
  expect(screen.getByText('Total Activities')).toBeInTheDocument();
  expect(screen.getByText('Reading Days')).toBeInTheDocument();
  expect(screen.getByText(/days since jan 15, 2024/i)).toBeInTheDocument();
});

it('counts from a configured start date instead of the first entry', () => {
  // The clock is pinned, and the start date is written out rather than derived
  // from it. The component parses `YYYY-MM-DD` as *local* midnight, so a date
  // built from `toISOString()` (which is UTC) was a day off for any run
  // happening while the local date and the UTC date disagree — this test failed
  // for three hours every night in UTC+3, and would fail all day west of UTC.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-09T12:00:00'));
  const twoDaysAgo = '2026-08-07';

  mockedUseStatistics.mockReturnValue({
    statistics: {
      totalHours: 0,
      totalActivities: 0,
      firstEntryDate: '2024-01-15',
      daysSinceFirstEntry: 100,
      types: []
    },
    loading: false,
    error: null
  });

  render(<StatsCards highlightTypeIds={[]} startDate={twoDaysAgo} />);

  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.queryByText(/days since jan 15, 2024/i)).not.toBeInTheDocument();
});

it('shows "no entries yet" when there is no first entry date', () => {
  mockedUseStatistics.mockReturnValue({
    statistics: { totalHours: 0, totalActivities: 0, firstEntryDate: null, daysSinceFirstEntry: 0, types: [] },
    loading: false,
    error: null
  });
  render(<StatsCards highlightTypeIds={[]} />);
  expect(screen.getByText('no entries yet')).toBeInTheDocument();
});

it('ignores highlight type ids that are not present in the statistics response', () => {
  mockedUseStatistics.mockReturnValue({
    statistics: { totalHours: 0, totalActivities: 0, firstEntryDate: null, daysSinceFirstEntry: 0, types: [] },
    loading: false,
    error: null
  });
  render(<StatsCards highlightTypeIds={['missing-type']} />);
  expect(screen.queryByText(/Days$/, { exact: false })).toBeTruthy(); // base "Days" card still renders
});

it('changes the timeframe and updates the subtitle label', async () => {
  mockedUseStatistics.mockReturnValue({
    statistics: { totalHours: 5, totalActivities: 2, firstEntryDate: null, daysSinceFirstEntry: 1, types: [] },
    loading: false,
    error: null
  });
  render(<StatsCards highlightTypeIds={[]} />);

  expect(screen.getAllByText(/for all time/i).length).toBeGreaterThan(0);

  await userEvent.click(screen.getByLabelText('Timeframe'));
  await userEvent.click(await screen.findByRole('option', { name: 'This Month' }));

  expect(mockedUseStatistics).toHaveBeenLastCalledWith({ timeframe: 'month', groupId: 'g1' });
});
