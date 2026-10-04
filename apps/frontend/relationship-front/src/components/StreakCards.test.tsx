import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../hooks/useStreaks', () => ({ useStreaks: vi.fn() }));

import { useStreaks } from '../hooks/useStreaks';
import { StreakStatistics, TypeCadence } from '../services/statistics';
import StreakCards from './StreakCards';

const mockedUseStreaks = useStreaks as unknown as ReturnType<typeof vi.fn>;

const cadence = (over: Partial<TypeCadence> = {}): TypeCadence => ({
  typeId: 't1',
  slug: 'date-night',
  name: 'Date night',
  color: '#FF5733',
  lastDate: '2026-02-04',
  daysSince: 34,
  loggedDays: 3,
  typicalGapDays: 17,
  overdueRatio: 2,
  ...over
});

const streaks = (over: Partial<StreakStatistics> = {}): StreakStatistics => ({
  currentStreak: 3,
  longestStreak: 9,
  longestStreakStart: '2026-01-01',
  longestStreakEnd: '2026-01-09',
  totalLoggedDays: 40,
  lastEntryDate: '2026-03-10',
  daysSinceLastEntry: 0,
  types: [cadence()],
  ...over
});

const renderCards = (props: { hiddenTypeIds?: string[]; maxNudges?: number } = {}) =>
  render(
    <MemoryRouter>
      <StreakCards hiddenTypeIds={props.hiddenTypeIds ?? []} maxNudges={props.maxNudges} />
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

it('shows a spinner while loading', () => {
  mockedUseStreaks.mockReturnValue({ streaks: null, loading: true, error: null });
  renderCards();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the query fails', () => {
  mockedUseStreaks.mockReturnValue({ streaks: null, loading: false, error: 'boom' });
  renderCards();
  expect(screen.getByText('boom')).toBeInTheDocument();
});

it('renders nothing before anything has been logged', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ totalLoggedDays: 0, lastEntryDate: null, daysSinceLastEntry: null, types: [] }),
    loading: false,
    error: null
  });
  const { container } = renderCards();
  expect(container).toBeEmptyDOMElement();
});

it('renders the streak cards and a nudge with its cadence', () => {
  mockedUseStreaks.mockReturnValue({ streaks: streaks(), loading: false, error: null });
  renderCards();

  expect(screen.getByText('Current Streak')).toBeInTheDocument();
  expect(screen.getByText('3 days')).toBeInTheDocument();
  expect(screen.getByText('9 days')).toBeInTheDocument();
  expect(screen.getByText(/jan 1, 2026 → jan 9, 2026/i)).toBeInTheDocument();
  expect(screen.getByText('40')).toBeInTheDocument();
  expect(screen.getByText(/most recent: today/i)).toBeInTheDocument();

  expect(screen.getByText('Date night')).toBeInTheDocument();
  expect(screen.getByText('34d')).toBeInTheDocument();
  expect(screen.getByText('· every 17d')).toBeInTheDocument();
});

it('puts the exact date and cadence in the nudge tooltip', async () => {
  mockedUseStreaks.mockReturnValue({ streaks: streaks(), loading: false, error: null });
  renderCards();

  await userEvent.hover(screen.getByText('Date night'));
  expect(await screen.findByText('Last logged Feb 4, 2026 — usually every 17 days')).toBeInTheDocument();
});

it('reports how long it has been when the streak is broken', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ currentStreak: 0, daysSinceLastEntry: 1, lastEntryDate: '2026-03-09' }),
    loading: false,
    error: null
  });
  renderCards();

  expect(screen.getByText('0 days')).toBeInTheDocument();
  expect(screen.getByText('nothing logged for 1 day')).toBeInTheDocument();
  expect(screen.getByText(/most recent: yesterday/i)).toBeInTheDocument();
});

it('spells out a longer gap since the last entry', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ currentStreak: 0, daysSinceLastEntry: 5, lastEntryDate: '2026-03-05' }),
    loading: false,
    error: null
  });
  renderCards();

  expect(screen.getByText('nothing logged for 5 days')).toBeInTheDocument();
  expect(screen.getByText('most recent: 5 days ago')).toBeInTheDocument();
});

it('collapses a single-day longest streak to one date', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ longestStreak: 1, longestStreakStart: '2026-01-01', longestStreakEnd: '2026-01-01' }),
    loading: false,
    error: null
  });
  renderCards();
  expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
});

it('says there is no streak yet when the bounds are missing', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ longestStreakStart: null, longestStreakEnd: null }),
    loading: false,
    error: null
  });
  renderCards();
  expect(screen.getByText('no streak yet')).toBeInTheDocument();
});

it('nudges only about types past their own usual gap, hidden ones excluded', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({
      types: [
        cadence({ typeId: 'overdue', name: 'Date night', overdueRatio: 2 }),
        cadence({ typeId: 'on-track', name: 'Walks', overdueRatio: 0.5 }),
        cadence({ typeId: 'no-rhythm', name: 'Concert', typicalGapDays: null, overdueRatio: null }),
        cadence({ typeId: 'hidden', name: 'Gaming', overdueRatio: 3 })
      ]
    }),
    loading: false,
    error: null
  });
  renderCards({ hiddenTypeIds: ['hidden'] });

  expect(screen.getByText('Date night')).toBeInTheDocument();
  expect(screen.queryByText('Walks')).not.toBeInTheDocument();
  expect(screen.queryByText('Concert')).not.toBeInTheDocument();
  expect(screen.queryByText('Gaming')).not.toBeInTheDocument();
});

it('caps the number of nudges shown', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({
      types: [
        cadence({ typeId: 'a', name: 'A' }),
        cadence({ typeId: 'b', name: 'B' }),
        cadence({ typeId: 'c', name: 'C' })
      ]
    }),
    loading: false,
    error: null
  });
  renderCards({ maxNudges: 2 });

  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('B')).toBeInTheDocument();
  expect(screen.queryByText('C')).not.toBeInTheDocument();
});

it('rounds a sub-daily cadence up to one day rather than showing "every 0d"', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ types: [cadence({ typicalGapDays: 0.4, overdueRatio: 4 })] }),
    loading: false,
    error: null
  });
  renderCards();
  expect(screen.getByText('· every 1d')).toBeInTheDocument();
});

it('skips a type whose cadence is unknown even if the API sent a ratio', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ types: [cadence({ typicalGapDays: null, overdueRatio: 4 })] }),
    loading: false,
    error: null
  });
  renderCards();
  expect(screen.queryByText('Date night')).not.toBeInTheDocument();
  expect(screen.getByText('Nothing overdue')).toBeInTheDocument();
});

it('falls back to the urgency colour for a type with no colour of its own', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ types: [cadence({ color: undefined })] }),
    loading: false,
    error: null
  });
  renderCards();
  expect(screen.getByText('Date night')).toBeInTheDocument();
});

it('says nothing is overdue when every type is within its rhythm', () => {
  mockedUseStreaks.mockReturnValue({
    streaks: streaks({ types: [cadence({ overdueRatio: 0.2 })] }),
    loading: false,
    error: null
  });
  renderCards();

  expect(screen.getByText('Nothing overdue')).toBeInTheDocument();
  expect(screen.queryByText('Date night')).not.toBeInTheDocument();
});
