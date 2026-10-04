import { render, screen } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../hooks/useMilestones', () => ({ useMilestones: vi.fn() }));

import { useMilestones } from '../hooks/useMilestones';
import { Milestone, MilestonesResult } from '../services/statistics';
import MilestonesCard from './MilestonesCard';

const mockedUseMilestones = useMilestones as unknown as ReturnType<typeof vi.fn>;

const upcomingDate = (over: Partial<Milestone> = {}): Milestone => ({
  kind: 'days-together',
  key: 'days-together:500',
  label: '500 days together',
  target: 500,
  unit: 'days',
  expectedOn: '2026-03-11',
  daysAway: 1,
  ...over
});

const upcomingCount = (over: Partial<Milestone> = {}): Milestone => ({
  kind: 'type-count',
  key: 'type-count:t1:25',
  label: '25 × Dinner',
  target: 25,
  unit: 'entries',
  typeId: 't1',
  color: '#FF5733',
  remaining: 5,
  expectedOn: '2026-05-01',
  daysAway: 52,
  projected: true,
  ...over
});

const result = (over: Partial<MilestonesResult> = {}): MilestonesResult => ({
  since: '2024-10-27',
  daysTogether: 499,
  recent: [],
  upcoming: [upcomingDate()],
  ...over
});

const renderCard = (props: { maxItems?: number } = {}) => render(<MilestonesCard {...props} />);

beforeEach(() => vi.clearAllMocks());

it('shows a spinner while loading', () => {
  mockedUseMilestones.mockReturnValue({ milestones: null, loading: true, error: null });
  renderCard();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the query fails', () => {
  mockedUseMilestones.mockReturnValue({ milestones: null, loading: false, error: 'boom' });
  renderCard();
  expect(screen.getByText('boom')).toBeInTheDocument();
});

it('renders nothing when there is neither a recent nor an upcoming milestone', () => {
  mockedUseMilestones.mockReturnValue({
    milestones: result({ recent: [], upcoming: [] }),
    loading: false,
    error: null
  });
  const { container } = renderCard();
  expect(container).toBeEmptyDOMElement();
});

it('renders an upcoming date milestone with how far off it is', () => {
  mockedUseMilestones.mockReturnValue({ milestones: result(), loading: false, error: null });
  renderCard();

  expect(screen.getByText('Milestones')).toBeInTheDocument();
  expect(screen.getByText('500 days together')).toBeInTheDocument();
  expect(screen.getByText('tomorrow')).toBeInTheDocument();
});

it('hedges a projected count milestone and shows its progress', () => {
  mockedUseMilestones.mockReturnValue({
    milestones: result({ upcoming: [upcomingCount()] }),
    loading: false,
    error: null
  });
  renderCard();

  expect(screen.getByText('25 × Dinner')).toBeInTheDocument();
  // Projections are prefixed so an estimate never reads as a settled date.
  expect(screen.getByText('~in 7 weeks')).toBeInTheDocument();
  // What is left is the headline; the projected date sits under the bar.
  expect(screen.getByText('5 to go')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: '25 × Dinner progress' })).toHaveAttribute('aria-valuenow', '80');
});

it('gives a date milestone no progress bar — its distance is already in words', () => {
  mockedUseMilestones.mockReturnValue({ milestones: result(), loading: false, error: null });
  renderCard();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it('renders reached milestones with how long ago they were', () => {
  mockedUseMilestones.mockReturnValue({
    milestones: result({
      recent: [
        {
          kind: 'anniversary',
          key: 'anniversary:2',
          label: '2 years together',
          target: 2,
          unit: 'years',
          achievedOn: '2026-03-01',
          daysAgo: 9
        }
      ]
    }),
    loading: false,
    error: null
  });
  renderCard();

  expect(screen.getByText('2 years together')).toBeInTheDocument();
  expect(screen.getByText('9 days ago')).toBeInTheDocument();
});

it('says so in each column when only one side has anything', () => {
  mockedUseMilestones.mockReturnValue({ milestones: result(), loading: false, error: null });
  renderCard();
  expect(screen.getByText('No milestones passed recently.')).toBeInTheDocument();
});

it('caps each column at maxItems', () => {
  mockedUseMilestones.mockReturnValue({
    milestones: result({
      upcoming: [upcomingDate(), upcomingCount(), upcomingCount({ key: 'type-count:t2:50', label: '50 × Cinema' })]
    }),
    loading: false,
    error: null
  });
  renderCard({ maxItems: 2 });

  expect(screen.getByText('500 days together')).toBeInTheDocument();
  expect(screen.getByText('25 × Dinner')).toBeInTheDocument();
  expect(screen.queryByText('50 × Cinema')).not.toBeInTheDocument();
});
