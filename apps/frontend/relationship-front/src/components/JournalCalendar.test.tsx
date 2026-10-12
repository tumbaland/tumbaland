import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('../services/days', () => ({
  getDays: vi.fn()
}));
vi.mock('../services/plans', () => ({
  getPlans: vi.fn()
}));

import { getDays } from '../services/days';
import { getPlans } from '../services/plans';
import JournalCalendar, { currentMonth } from './JournalCalendar';

const mockedGetDays = getDays as unknown as ReturnType<typeof vi.fn>;
const mockedGetPlans = getPlans as unknown as ReturnType<typeof vi.fn>;

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
  const onPlanClick = vi.fn();
  const onNewPlan = vi.fn();
  const result = render(
    <JournalCalendar
      month={may2024}
      onMonthChange={onMonthChange}
      groupId="g1"
      refreshKey={0}
      onDayClick={onDayClick}
      onPlanClick={onPlanClick}
      onNewPlan={onNewPlan}
      {...props}
    />
  );
  return { ...result, onMonthChange, onDayClick, onPlanClick, onNewPlan };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDays.mockResolvedValue({ days: [], page: 1, totalPages: 0, total: 0 });
  mockedGetPlans.mockResolvedValue([]);
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
    expect(mockedGetDays).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2024-02-01', endDate: '2024-02-29' })
    )
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

const plan = (over: Record<string, unknown> = {}) => ({
  _id: 'p1',
  id: 'p1',
  title: 'Concert',
  date: '2099-05-16',
  endDate: null,
  time: '19:00',
  timeZone: 'Europe/Tallinn',
  startsAt: '2099-05-16T16:00:00.000Z',
  typeId: null,
  location: { label: 'Saku Arena', lat: 59.4, lng: 24.7 },
  remindBefore: 60,
  remindAt: '2099-05-16T15:00:00.000Z',
  remindedAt: null,
  loggedActivityId: null,
  userId: 'u1',
  ...over
});
const may2099 = { year: 2099, month: 4 };

it('fetches the month’s plans along with its days', async () => {
  renderCalendar();
  await waitFor(() =>
    expect(mockedGetPlans).toHaveBeenCalledWith({ groupId: 'g1', startDate: '2024-05-01', endDate: '2024-05-31' })
  );
});

it('starts a plan on a day after today that has none', async () => {
  const { onNewPlan, onDayClick } = renderCalendar({ month: may2099 });
  await screen.findByText(/logged this month/);
  await userEvent.click(screen.getByRole('button', { name: 'Friday, May 15' }));
  expect(onNewPlan).toHaveBeenCalledWith('2099-05-15');
  expect(onDayClick).not.toHaveBeenCalled();
});

it('shows a later day’s plan, opens it from the day, and lists the month’s plans', async () => {
  mockedGetPlans.mockResolvedValue([plan()]);
  const { onPlanClick } = renderCalendar({ month: may2099 });

  expect(await screen.findByText('0 days logged this month · 1 plan')).toBeInTheDocument();
  expect(screen.getByText('Plans this month')).toBeInTheDocument();
  expect(screen.getByText(/at 19:00 · Saku Arena/)).toBeInTheDocument();
  expect(screen.getByLabelText('Reminder set')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Saturday, May 16, 1 planned' }));
  expect(onPlanClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));

  await userEvent.click(screen.getByText('Concert', { selector: 'p' }));
  expect(onPlanClick).toHaveBeenCalledTimes(2);
});

it('puts a trip on every one of its days, into the next month', async () => {
  mockedGetPlans.mockResolvedValue([plan({ title: 'Rome', date: '2099-05-30', endDate: '2099-06-02', time: null })]);
  const { onPlanClick } = renderCalendar({ month: may2099 });
  await screen.findByText(/1 plan/);
  expect(screen.getByText(/to Tue 2 Jun|to Tue, Jun 2/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Sunday, May 31, 1 planned' }));
  expect(onPlanClick).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rome' }));
  expect(screen.getByRole('button', { name: 'Friday, May 29' })).toBeInTheDocument();
});

it('starts another plan on a later day that already has two', async () => {
  mockedGetPlans.mockResolvedValue([plan(), plan({ id: 'p2', _id: 'p2', title: 'Dinner', time: null })]);
  const { onNewPlan } = renderCalendar({ month: may2099 });
  await screen.findByText(/2 plans/);
  expect(screen.getByText(/, all day/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Saturday, May 16, 2 planned' }));
  expect(onNewPlan).toHaveBeenCalledWith('2099-05-16');
});

it('opens a past day with a plan in the day editor, so it can be logged', async () => {
  mockedGetPlans.mockResolvedValue([plan({ date: '2024-05-10', loggedActivityId: 'a1' })]);
  const { onDayClick } = renderCalendar();
  await screen.findByText(/1 plan/);
  expect(screen.getByText(/in the journal/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Friday, May 10, 1 planned' }));
  expect(onDayClick).toHaveBeenCalledWith('2024-05-10');
});

it('fetches the month again when the page bumps the refresh key', async () => {
  const { rerender } = renderCalendar();
  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(1));
  rerender(
    <JournalCalendar
      month={may2024}
      onMonthChange={vi.fn()}
      groupId="g1"
      refreshKey={1}
      onDayClick={vi.fn()}
      onPlanClick={vi.fn()}
      onNewPlan={vi.fn()}
    />
  );
  await waitFor(() => expect(mockedGetDays).toHaveBeenCalledTimes(2));
});

it('says so when the month fails to load', async () => {
  mockedGetDays.mockRejectedValue(new Error('boom'));
  renderCalendar();
  expect(await screen.findByText('Failed to load this month')).toBeInTheDocument();
});
