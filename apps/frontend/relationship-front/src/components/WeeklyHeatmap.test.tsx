import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/statistics', () => ({
  getWeeklyHeatmapData: vi.fn()
}));

import { getWeeklyHeatmapData } from '../services/statistics';
import WeeklyHeatmap from './WeeklyHeatmap';

const mockedGetHeatmap = getWeeklyHeatmapData as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a spinner while loading', () => {
  mockedGetHeatmap.mockReturnValue(new Promise(() => {}));
  render(<WeeklyHeatmap />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedGetHeatmap.mockRejectedValue(new Error('boom'));
  render(<WeeklyHeatmap />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedGetHeatmap.mockRejectedValue('nope');
  render(<WeeklyHeatmap />);
  expect(await screen.findByText('Failed to load data')).toBeInTheDocument();
});

it('renders the grid and computed summary stats', async () => {
  mockedGetHeatmap.mockResolvedValue([
    { date: '2024-01-01', totalActivities: 3, totalHours: 3, activities: { reading: { count: 3, hours: 3 } } },
    { date: '2024-01-02', totalActivities: 1, totalHours: 1, activities: { reading: { count: 1, hours: 1 } } }
  ]);

  render(<WeeklyHeatmap title="My Heatmap" year={2024} />);

  await waitFor(() => expect(screen.getByText('My Heatmap')).toBeInTheDocument());
  expect(screen.getByText('2 days with activities')).toBeInTheDocument();
  expect(screen.getByText('Total Activities').previousSibling).toHaveTextContent('4');
  expect(screen.getByText('Active Days').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('Max Per Day').previousSibling).toHaveTextContent('3');
});

it('excludes hidden activity types from the effective counts', async () => {
  mockedGetHeatmap.mockResolvedValue([
    {
      date: '2024-01-01',
      totalActivities: 3,
      totalHours: 3,
      activities: { reading: { count: 2, hours: 2 }, gaming: { count: 1, hours: 1 } }
    }
  ]);

  render(<WeeklyHeatmap year={2024} hiddenSlugs={new Set(['gaming'])} />);

  await waitFor(() => expect(screen.getByText('Total Activities').previousSibling).toHaveTextContent('2'));
});

it('renders with no data', async () => {
  mockedGetHeatmap.mockResolvedValue([]);
  render(<WeeklyHeatmap year={2024} />);
  await waitFor(() => expect(screen.getByText('0 days with activities')).toBeInTheDocument());
  expect(screen.getByText('Total Activities').previousSibling).toHaveTextContent('0');
});

it('changes the selected year, refetching data', async () => {
  mockedGetHeatmap.mockResolvedValue([{ date: '2024-01-01', totalActivities: 1, totalHours: 1, activities: {} }]);
  render(<WeeklyHeatmap year={2024} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('2024'));

  const yearLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Year')!;
  const combobox = yearLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
  const options = await screen.findAllByRole('option');
  await userEvent.click(options[options.length - 1]);

  expect(mockedGetHeatmap).toHaveBeenCalledTimes(2);
});
