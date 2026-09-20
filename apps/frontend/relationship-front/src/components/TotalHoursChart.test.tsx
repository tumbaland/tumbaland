import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/statistics', () => ({
  getMonthlyActivityBreakdown: vi.fn()
}));

import { getMonthlyActivityBreakdown } from '../services/statistics';
import TotalHoursChart from './TotalHoursChart';

const mockedGetBreakdown = getMonthlyActivityBreakdown as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a spinner while loading', () => {
  mockedGetBreakdown.mockReturnValue(new Promise(() => {}));
  render(<TotalHoursChart />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedGetBreakdown.mockRejectedValue(new Error('boom'));
  render(<TotalHoursChart />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedGetBreakdown.mockRejectedValue('nope');
  render(<TotalHoursChart />);
  expect(await screen.findByText('Failed to load data')).toBeInTheDocument();
});

it('shows an empty state when there is no data', async () => {
  mockedGetBreakdown.mockResolvedValue([]);
  render(<TotalHoursChart />);
  expect(await screen.findByText('No data available')).toBeInTheDocument();
});

it('renders the chart and computed summary stats', async () => {
  mockedGetBreakdown.mockResolvedValue([
    { month: '1', year: 2024, activities: {}, totalHours: 10, totalActivities: 3 },
    { month: '2', year: 2024, activities: {}, totalHours: 20, totalActivities: 5 }
  ]);

  render(<TotalHoursChart title="My Chart" />);

  // Wait on a data-dependent value (present only once loading resolves) rather than the
  // static title, which x-charts' async internal layout effects can otherwise race with.
  expect(await screen.findByText('30')).toBeInTheDocument(); // total
  expect(screen.getByText('My Chart')).toBeInTheDocument();
  // Chart axis ticks can coincide with small stat numbers (e.g. avg=15), so scope the
  // avg/peak checks to their labeled stat block instead of a bare getByText.
  expect(screen.getByText('Avg Hours per Month').previousSibling).toHaveTextContent('15');
  expect(screen.getByText('Peak Hours').previousSibling).toHaveTextContent('20');
});

it('changes the selected year, refetching data', async () => {
  mockedGetBreakdown.mockResolvedValue([{ month: '1', year: 2024, activities: {}, totalHours: 5, totalActivities: 1 }]);
  render(<TotalHoursChart year={2024} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('2024'));

  const yearLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Year')!;
  const combobox = yearLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
  await userEvent.click(await screen.findByRole('option', { name: 'All Years' }));

  expect(mockedGetBreakdown).toHaveBeenCalledWith(undefined, 'g1');
});
