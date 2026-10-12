import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('../services/days', () => ({
  getDays: vi.fn()
}));

import { getDays } from '../services/days';
import JournalCalendar, { currentMonth } from './JournalCalendar';

const mockedGetDays = getDays as unknown as ReturnType<typeof vi.fn>;

const type = (name: string, color: string) => ({
  _id: name,
  id: name,
  name,
  slug: name.toLowerCase(),
  color,
  isActive: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  userId: 'u1'
});
const reading = type('Reading', '#111');
const cooking = type('Cooking', '#222');
const hiking = type('Hiking', '#333');

const may2024 = { year: 2024, month: 4 };

const renderCalendar = (props: Partial<Parameters<typeof JournalCalendar>[0]> = {}) => {
  const onMonthChange = vi.fn();
  const onDayClick = vi.fn();
  const result = render(
    <JournalCalendar
      month={may2024}
      onMonthChange={onMonthChange}
      groupId="g1"
      refreshKey={0}
      onDayClick={onDayClick}
      {...props}
    />
  );
  return { ...result, onMonthChange, onDayClick };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 0, total: 0 });
});

it('fetches exactly the month on screen, with the filters', async () => {
  renderCalendar({ typeId: 't1', search: 'walk' });
  await waitFor(() =>
    expect(mockedGetDays).toHaveBeenCalledWith({
      page: 1,
      limit: 31,
      groupId: 'g1',
      typeId: 't1',
      search: 'walk',
      startDate: '2024-05-01',
      endDate: '2024-05-31'
    })
  );
});

it('ends February on the right day in a leap year', async () => {
  renderCalendar({ month: { year: 2024, month: 1 } });
  await waitFor(() =>
    expect(mockedGetDays).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2024-02-01', endDate: '2024-02-29' }))
  );
});

it('lays out every day of the month under its weekday, starting on Monday', async () => {
  renderCalendar();
  await screen.findByText('0 days logged this month');
  expect(screen.getAllByRole('button', { name: /May \d+/ })).toHaveLength(31);
  // 1 May 2024 was a Wednesday: two blanks (Mon, Tue) come before it.
  const grid = screen.getByText('Mon').parentElement!;
  const firstDay = screen.getByRole('button', { name: 'Wednesday, May 1' });
  expect(Array.from(grid.children).indexOf(firstDay)).toBe(7 + 2);
});

it('marks logged days with their entries and counts them', async () => {
  mockedGetDays.mockResolvedValue({
    days: [
      {
        date: '2024-05-10',
        entries: [
          { _id: 'e1', typeId: 'Reading', type: reading, date: '2024-05-10' },
          { _id: 'e2', typeId: 'Cooking', type: cooking, date: '2024-05-10' },
          { _id: 'e3', typeId: 'Hiking', type: hiking, date: '2024-05-10' }
        ]
      }
    ],
    page: 1,
    totalPages: 1,
    total: 1
  });
  renderCalendar();

  expect(await screen.findByText('1 day logged this month')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Friday, May 10, 3 logged' })).toBeInTheDocument();
  expect(screen.getByText('Reading')).toBeInTheDocument();
  expect(screen.getByText('Cooking')).toBeInTheDocument();
  expect(screen.queryByText('Hiking')).not.toBeInTheDocument();
  expect(screen.getByText('+1 more')).toBeInTheDocument();
});

it('opens a day when it is tapped', async () => {
  const { onDayClick } = renderCalendar();
  await screen.findByText('0 days logged this month');
  await userEvent.click(screen.getByRole('button', { name: 'Friday, May 10' }));
  expect(onDayClick).toHaveBeenCalledWith('2024-05-10');
});

it('moves between months, and back to this one', async () => {
  const { onMonthChange } = renderCalendar({ month: { year: 2024, month: 0 } });
  await screen.findByText('January 2024');

  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
  expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2023, month: 11 });

  await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2024, month: 1 });

  await userEvent.click(screen.getByRole('button', { name: 'This month' }));
  expect(onMonthChange).toHaveBeenLastCalledWith(currentMonth());
});

it('does not let a day after today be opened', async () => {
  const now = new Date();
  renderCalendar({ month: currentMonth() });
  await screen.findByText(/logged this month/);
  expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument();

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (lastDay.getDate() === now.getDate()) return; // nothing after today this month
  const label = lastDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  expect(screen.getByRole('button', { name: label })).toBeDisabled();
});

it('fetches the month again when the page bumps the refresh key', async () => {
  const { rerender } = renderCalendar();
  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(1));
  rerender(<JournalCalendar month={may2024} onMonthChange={vi.fn()} groupId="g1" refreshKey={1} onDayClick={vi.fn()} />);
  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(2));
});

it('says so when the month fails to load', async () => {
  mockedGetDays.mockRejectedValue(new Error('boom'));
  renderCalendar();
  expect(await screen.findByText('Failed to load this month')).toBeInTheDocument();
});
