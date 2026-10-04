import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../hooks/useTrends', () => ({ useTrends: vi.fn() }));

import { useTrends } from '../hooks/useTrends';
import { TrendsResult, TypeTrend } from '../services/statistics';
import TrendsCard from './TrendsCard';

const mockedUseTrends = useTrends as unknown as ReturnType<typeof vi.fn>;

const trend = (over: Partial<TypeTrend> = {}): TypeTrend => ({
  typeId: 't1',
  slug: 'dinner',
  name: 'Dinner',
  color: '#FF5733',
  valueType: 'string',
  current: { entries: 9, hours: 12, activeDays: 6 },
  previous: { entries: 6, hours: 8, activeDays: 5 },
  entriesDelta: 3,
  hoursDelta: 4,
  activeDaysDelta: 1,
  entriesChangePct: 50,
  hoursChangePct: 50,
  direction: 'up',
  ...over
});

const result = (over: Partial<TrendsResult> = {}): TrendsResult => ({
  windowDays: 30,
  currentStart: '2026-02-09',
  currentEnd: '2026-03-10',
  previousStart: '2026-01-10',
  previousEnd: '2026-02-08',
  totals: {
    current: { entries: 9, hours: 12, activeDays: 6 },
    previous: { entries: 6, hours: 8, activeDays: 5 },
    entriesDelta: 3,
    hoursDelta: 4,
    activeDaysDelta: 1,
    entriesChangePct: 50,
    hoursChangePct: 50,
    direction: 'up'
  },
  types: [trend()],
  ...over
});

const ready = (over: Partial<TrendsResult> = {}) => ({
  trends: result(over),
  loading: false,
  error: null
});

beforeEach(() => vi.clearAllMocks());

it('shows a spinner on the first load, before there is anything to keep on screen', () => {
  mockedUseTrends.mockReturnValue({ trends: null, loading: true, error: null });
  render(<TrendsCard />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('keeps the rows and the window selector on screen while refetching', () => {
  mockedUseTrends.mockReturnValue({ trends: result(), loading: true, error: null });
  render(<TrendsCard />);

  expect(screen.getByText('Dinner')).toBeInTheDocument();
  expect(screen.getByLabelText('Window')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Loading trends' })).toBeInTheDocument();
});

it('shows an error message when the query fails', () => {
  mockedUseTrends.mockReturnValue({ trends: null, loading: false, error: 'boom' });
  render(<TrendsCard />);
  expect(screen.getByText('boom')).toBeInTheDocument();
});

it('renders nothing when neither window has an entry', () => {
  mockedUseTrends.mockReturnValue(ready({ types: [] }));
  const { container } = render(<TrendsCard />);
  expect(container).toBeEmptyDOMElement();
});

it('asks for a 30-day window by default, scoped to the current tenant', () => {
  mockedUseTrends.mockReturnValue(ready());
  render(<TrendsCard />);
  expect(mockedUseTrends).toHaveBeenCalledWith(30, 'g1');
});

it('refetches with the chosen window', async () => {
  const user = userEvent.setup();
  mockedUseTrends.mockReturnValue(ready());
  render(<TrendsCard />);

  await user.click(screen.getByLabelText('Window'));
  await user.click(screen.getByRole('option', { name: 'Last 7 days' }));

  expect(mockedUseTrends).toHaveBeenLastCalledWith(7, 'g1');
});

it('spells out both windows and the totals across them', () => {
  // The one type row carries a change of its own, so it is given a distinct
  // one here and every +50% below belongs to the totals.
  mockedUseTrends.mockReturnValue(ready({ types: [trend({ entriesChangePct: 12 })] }));
  render(<TrendsCard />);

  expect(screen.getByText('Trends')).toBeInTheDocument();
  expect(screen.getByText('Feb 9 – Mar 10 against Jan 10 – Feb 8')).toBeInTheDocument();
  expect(screen.getByText('Active days')).toBeInTheDocument();
  // Entries and hours have a baseline to divide by, so both read as percentages.
  expect(screen.getAllByText('+50%')).toHaveLength(2);
  // Active days has no percentage of its own, so the raw delta stands in.
  expect(screen.getByText('+1')).toBeInTheDocument();
});

it('shows each type as before → after with its percentage change', () => {
  mockedUseTrends.mockReturnValue(ready());
  render(<TrendsCard />);

  expect(screen.getByText('Dinner')).toBeInTheDocument();
  expect(screen.getByText('6 → 9')).toBeInTheDocument();
});

it('calls out a type with no previous window by count rather than as a percentage', () => {
  mockedUseTrends.mockReturnValue(
    ready({
      types: [
        trend({
          previous: { entries: 0, hours: 0, activeDays: 0 },
          entriesDelta: 9,
          entriesChangePct: null,
          direction: 'new'
        })
      ]
    })
  );
  render(<TrendsCard />);

  expect(screen.getByText('+9 new')).toBeInTheDocument();
});

it('calls a type that fell to nothing stopped rather than -100%', () => {
  mockedUseTrends.mockReturnValue(
    ready({
      types: [
        trend({
          current: { entries: 0, hours: 0, activeDays: 0 },
          entriesDelta: -6,
          entriesChangePct: -100,
          direction: 'stopped'
        })
      ]
    })
  );
  render(<TrendsCard />);

  expect(screen.getByText('stopped')).toBeInTheDocument();
});

it('scales every bar against the busiest window on the card', () => {
  mockedUseTrends.mockReturnValue(
    ready({
      types: [
        trend({ typeId: 'busy', name: 'Busy', current: { entries: 20, hours: 0, activeDays: 4 } }),
        trend({ typeId: 'quiet', name: 'Quiet', current: { entries: 5, hours: 0, activeDays: 2 } })
      ]
    })
  );
  render(<TrendsCard />);

  // 20 is the busiest window across both rows, so it fills the bar and the
  // quieter type reads as the quarter of it that it is.
  expect(screen.getByRole('progressbar', { name: 'Busy current window' })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByRole('progressbar', { name: 'Quiet current window' })).toHaveAttribute('aria-valuenow', '25');
});

it('lists at most maxItems types', () => {
  mockedUseTrends.mockReturnValue(
    ready({
      types: [
        trend({ typeId: 't1', name: 'First' }),
        trend({ typeId: 't2', name: 'Second' }),
        trend({ typeId: 't3', name: 'Third' })
      ]
    })
  );
  const { container } = render(<TrendsCard maxItems={2} />);

  expect(screen.getByText('First')).toBeInTheDocument();
  expect(screen.getByText('Second')).toBeInTheDocument();
  expect(screen.queryByText('Third')).not.toBeInTheDocument();
  expect(within(container).queryByLabelText('Third current window')).not.toBeInTheDocument();
});
