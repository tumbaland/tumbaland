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
vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn()
}));

import { getMonthlyActivityBreakdown } from '../services/statistics';
import { getActivityTypes } from '../services/activityTypes';
import HoursBarChart from './HoursBarChart';

const mockedGetBreakdown = getMonthlyActivityBreakdown as unknown as ReturnType<typeof vi.fn>;
const mockedGetActivityTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;

const activityTypes = [
  { _id: 't1', id: 't1', name: 'Reading', slug: 'reading', color: '#111', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', userId: 'u1' },
  { _id: 't2', id: 't2', name: 'Gaming', slug: 'gaming', color: '#222', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '', userId: 'u1' }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetActivityTypes.mockResolvedValue({ data: activityTypes, pagination: {} as any });
});

it('shows a spinner while loading', () => {
  mockedGetBreakdown.mockReturnValue(new Promise(() => {}));
  render(<HoursBarChart />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedGetBreakdown.mockRejectedValue(new Error('boom'));
  render(<HoursBarChart />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows an empty state when there is no data', async () => {
  mockedGetBreakdown.mockResolvedValue([]);
  render(<HoursBarChart />);
  expect(await screen.findByText('No data available')).toBeInTheDocument();
});

it('renders per-type legend chips and computed summary stats, excluding hidden types', async () => {
  mockedGetBreakdown.mockResolvedValue([
    { month: '1', year: 2024, totalHours: 0, totalActivities: 0, activities: { reading: { count: 3, hours: 3 }, gaming: { count: 2, hours: 2 } } },
    { month: '2', year: 2024, totalHours: 0, totalActivities: 0, activities: { reading: { count: 1, hours: 1 } } }
  ]);

  render(<HoursBarChart title="My Chart" hiddenSlugs={new Set(['gaming'])} />);

  await waitFor(() => expect(screen.getByText('My Chart')).toBeInTheDocument());
  expect(screen.getByText('Reading (4)')).toBeInTheDocument();
  expect(screen.queryByText(/Gaming/)).not.toBeInTheDocument();

  // With gaming hidden, totals only count reading: month1=3, month2=1 -> total 4, avg 2, peak 3
  expect(screen.getByText('Total Activities').previousSibling).toHaveTextContent('4');
  expect(screen.getByText('Avg Activities per Month').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('Peak Activities').previousSibling).toHaveTextContent('3');
});

it('falls back to the raw slug when an activity type is not found in the types list', async () => {
  mockedGetActivityTypes.mockResolvedValue({ data: [], pagination: {} as any });
  mockedGetBreakdown.mockResolvedValue([
    { month: '1', year: 2024, totalHours: 0, totalActivities: 0, activities: { mystery: { count: 1, hours: 1 } } }
  ]);

  render(<HoursBarChart />);

  expect(await screen.findByText('mystery (1)')).toBeInTheDocument();
});

it('changes the selected year, refetching data', async () => {
  mockedGetBreakdown.mockResolvedValue([
    { month: '1', year: 2024, totalHours: 0, totalActivities: 0, activities: { reading: { count: 1, hours: 1 } } }
  ]);
  render(<HoursBarChart year={2024} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('2024'));

  const yearLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Year')!;
  const combobox = yearLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
  await userEvent.click(await screen.findByRole('option', { name: 'All Years' }));

  expect(mockedGetBreakdown).toHaveBeenCalledWith(undefined, 'g1');
});
