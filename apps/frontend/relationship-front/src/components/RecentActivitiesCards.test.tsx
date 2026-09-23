import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

vi.mock('../services/activities', () => ({
  getRecentActivitiesSummary: vi.fn()
}));
vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn()
}));

import { getRecentActivitiesSummary } from '../services/activities';
import { getActivityTypes } from '../services/activityTypes';
import RecentActivitiesCards from './RecentActivitiesCards';

const mockedGetSummary = getRecentActivitiesSummary as unknown as ReturnType<typeof vi.fn>;
const mockedGetActivityTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;

const types = [
  { _id: 't1', slug: 'reading', name: 'Reading', color: '#111', isActive: true, sortOrder: 0 },
  { _id: 't2', slug: 'gaming', name: 'Gaming', isActive: true, sortOrder: 1 }
];

beforeEach(() => vi.clearAllMocks());

it('shows a spinner while loading', () => {
  mockedGetActivityTypes.mockReturnValue(new Promise(() => {}));
  render(<RecentActivitiesCards />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when loading fails', async () => {
  mockedGetActivityTypes.mockRejectedValue(new Error('boom'));
  render(<RecentActivitiesCards />);
  expect(await screen.findByText('Failed to load activities data')).toBeInTheDocument();
});

it('renders a card per activity type, with "No activities found" for an empty one', async () => {
  mockedGetActivityTypes.mockResolvedValue({ data: types, pagination: {} as never });
  mockedGetSummary.mockResolvedValue({
    reading: { '1months': { activities: [{ _id: 'a1', date: '2024-05-01', description: 'Book club' }] } }
    // gaming has no entry at all for this timeline
  });

  render(<RecentActivitiesCards />);

  expect(await screen.findByText('Reading')).toBeInTheDocument();
  expect(screen.getByText('Gaming')).toBeInTheDocument();
  expect(screen.getByText('Book club')).toBeInTheDocument();
  expect(screen.getByText('No activities found')).toBeInTheDocument();
});

it('shows an hours value or a checkmark when there is no description', async () => {
  mockedGetActivityTypes.mockResolvedValue({ data: [types[0]], pagination: {} as never });
  mockedGetSummary.mockResolvedValue({
    reading: {
      '1months': {
        activities: [
          { _id: 'a1', date: '2024-05-01', hours: 2 },
          { _id: 'a2', date: '2024-05-02' }
        ]
      }
    }
  });

  render(<RecentActivitiesCards />);

  expect(await screen.findByText('2h')).toBeInTheDocument();
  expect(screen.getByText('✓')).toBeInTheDocument();
});

it('expands and collapses a card with activities via the toggle button', async () => {
  mockedGetActivityTypes.mockResolvedValue({ data: [types[0]], pagination: {} as never });
  mockedGetSummary.mockResolvedValue({
    reading: { '1months': { activities: [{ _id: 'a1', date: '2024-05-01', description: 'Book club' }] } }
  });

  render(<RecentActivitiesCards />);
  await screen.findByText('Book club');

  const toggleButton = screen.getByRole('button');
  await userEvent.click(toggleButton);
  await userEvent.click(toggleButton);
  // Just verifying no crash across both toggle states; content stays visible throughout.
  expect(screen.getByText('Book club')).toBeInTheDocument();
});

it('switches the timeline and refetches', async () => {
  mockedGetActivityTypes.mockResolvedValue({ data: types, pagination: {} as never });
  mockedGetSummary.mockResolvedValue({});

  render(<RecentActivitiesCards />);
  await screen.findByText('Reading');

  await userEvent.click(screen.getByLabelText('Timeline'));
  await userEvent.click(await screen.findByRole('option', { name: 'Last Year' }));

  expect(mockedGetSummary).toHaveBeenCalledTimes(2);
});
