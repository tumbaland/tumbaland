import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/statistics', () => ({
  getCumulativeTimelineData: vi.fn()
}));
vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn()
}));

import { getCumulativeTimelineData } from '../services/statistics';
import { getActivityTypes } from '../services/activityTypes';
import CumulativeTimeline from './CumulativeTimeline';

const mockedGetTimeline = getCumulativeTimelineData as unknown as ReturnType<typeof vi.fn>;
const mockedGetActivityTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;

const activityTypes = [
  { _id: 't1', id: 't1', name: 'Reading', slug: 'reading', color: '#111', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetActivityTypes.mockResolvedValue({ data: activityTypes, pagination: {} as any });
});

it('shows a spinner while loading', () => {
  mockedGetTimeline.mockReturnValue(new Promise(() => {}));
  render(<CumulativeTimeline />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedGetTimeline.mockRejectedValue(new Error('boom'));
  render(<CumulativeTimeline />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows an empty state when there is no data', async () => {
  mockedGetTimeline.mockResolvedValue([]);
  render(<CumulativeTimeline />);
  expect(await screen.findByText('No data available')).toBeInTheDocument();
});

it('renders per-type chips and cumulative summary stats', async () => {
  mockedGetTimeline.mockResolvedValue([
    { date: '2024-01-01', dailyActivities: 2, cumulativeActivities: 2, dailyHours: 2, cumulativeHours: 2, activityBreakdown: { reading: { dailyCount: 2, cumulativeCount: 2 } } },
    { date: '2024-01-02', dailyActivities: 1, cumulativeActivities: 3, dailyHours: 1, cumulativeHours: 3, activityBreakdown: { reading: { dailyCount: 1, cumulativeCount: 3 } } }
  ]);

  render(<CumulativeTimeline title="My Chart" />);

  // Wait on a data-dependent value (present only once loading resolves) rather than the
  // static title, which x-charts' async internal layout effects can otherwise race with.
  expect(await screen.findByText('3')).toBeInTheDocument(); // total activities
  expect(screen.getByText('My Chart')).toBeInTheDocument();
  // "Reading" renders both as the toggle chip and as the chart's auto-generated legend entry.
  expect(screen.getAllByText('Reading').length).toBeGreaterThan(0);
  expect(screen.getByText('Total')).toBeInTheDocument();

  expect(screen.getByText('Total Activities').previousSibling).toHaveTextContent('3');
  expect(screen.getByText('Active Days').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('Avg Per Day').previousSibling).toHaveTextContent('2'); // round((2+1)/2)
});

it('toggles a line chip on and off without crashing', async () => {
  mockedGetTimeline.mockResolvedValue([
    { date: '2024-01-01', dailyActivities: 1, cumulativeActivities: 1, dailyHours: 1, cumulativeHours: 1, activityBreakdown: {} }
  ]);

  render(<CumulativeTimeline />);
  // Wait on a data-dependent value first, since the chart's async layout effects can otherwise
  // race with a findByText on chip/legend text that renders in two places at once.
  await screen.findByText('Active Days');
  const readingChip = screen.getAllByText('Reading')[0];

  await userEvent.click(readingChip);
  await userEvent.click(screen.getAllByText('Total')[0]);
  await userEvent.click(screen.getAllByText('Total')[0]);

  expect(screen.getByText('Active Days')).toBeInTheDocument();
});

it('changes the selected year, refetching data', async () => {
  mockedGetTimeline.mockResolvedValue([
    { date: '2024-01-01', dailyActivities: 1, cumulativeActivities: 1, dailyHours: 1, cumulativeHours: 1, activityBreakdown: {} }
  ]);
  render(<CumulativeTimeline year={2024} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('2024'));

  const yearLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Year')!;
  const combobox = yearLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
  await userEvent.click(await screen.findByRole('option', { name: 'All Years' }));

  expect(mockedGetTimeline).toHaveBeenCalledWith(undefined, 'g1');
});
