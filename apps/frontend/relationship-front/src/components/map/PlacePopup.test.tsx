import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('../../services/places', () => ({ getPlaceVisits: vi.fn() }));

import { getPlaceVisits } from '../../services/places';
import PlacePopup from './PlacePopup';
import { Place } from '../../services/types';

const mockedGetVisits = getPlaceVisits as unknown as ReturnType<typeof vi.fn>;

const place: Place = {
  id: '59.4405,24.7453',
  label: 'Kolm Sõsarat',
  lat: 59.4405,
  lng: 24.7453,
  visits: 3,
  firstVisit: '2024-01-02',
  lastVisit: '2024-06-11',
  types: [
    { typeId: 't1', name: 'Restaurants', slug: 'restaurants', color: '#FF5733', count: 2 },
    { typeId: 't2', name: 'Date night', slug: 'date-night', count: 1 }
  ]
};

const renderPopup = (over: Partial<Place> = {}, groupId?: string) =>
  render(
    <MemoryRouter>
      <PlacePopup place={{ ...place, ...over }} groupId={groupId} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetVisits.mockResolvedValue([]);
});

it('shows the place name, visit count and per-type breakdown', async () => {
  renderPopup();

  expect(screen.getByText('Kolm Sõsarat')).toBeInTheDocument();
  expect(screen.getByText(/3 visits · first/)).toBeInTheDocument();
  expect(screen.getByText('Restaurants · 2')).toBeInTheDocument();
  expect(screen.getByText('Date night · 1')).toBeInTheDocument();
  await waitFor(() => expect(mockedGetVisits).toHaveBeenCalled());
});

it('uses the singular form for a place visited once', async () => {
  renderPopup({ visits: 1 });

  expect(screen.getByText(/1 visit · first/)).toBeInTheDocument();
  await waitFor(() => expect(mockedGetVisits).toHaveBeenCalled());
});

it('shows a spinner until the visits arrive', () => {
  mockedGetVisits.mockReturnValue(new Promise(() => {}));
  renderPopup();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('requests the visits for this pin, scoped to the group', async () => {
  renderPopup({}, 'g1');

  await waitFor(() =>
    expect(mockedGetVisits).toHaveBeenCalledWith(59.4405, 24.7453, { groupId: 'g1', limit: 12 })
  );
});

it('lists visits with a link into that day in the journal', async () => {
  mockedGetVisits.mockResolvedValue([
    { date: '2024-06-11', typeId: 't1', typeName: 'Restaurants', description: 'tasting menu', hours: 3 }
  ]);
  renderPopup();

  const link = await screen.findByRole('link', { name: /Jun 11, 2024|11 Jun 2024|2024/ });
  expect(link).toHaveAttribute('href', '/journal?date=2024-06-11');
  expect(screen.getByText('Restaurants · tasting menu · 3h')).toBeInTheDocument();
});

it('notes when only the most recent visits are shown', async () => {
  mockedGetVisits.mockResolvedValue([{ date: '2024-06-11', typeId: 't1', typeName: 'Restaurants' }]);
  renderPopup({ visits: 9 });

  expect(await screen.findByText('Showing the 1 most recent')).toBeInTheDocument();
});

it('omits the truncation note when every visit is listed', async () => {
  mockedGetVisits.mockResolvedValue([
    { date: '2024-06-11', typeId: 't1' },
    { date: '2024-05-01', typeId: 't1' },
    { date: '2024-01-02', typeId: 't1' }
  ]);
  renderPopup();

  await screen.findAllByRole('link');
  expect(screen.queryByText(/most recent/)).not.toBeInTheDocument();
});

it('shows an error when the visits cannot be loaded', async () => {
  mockedGetVisits.mockRejectedValue(new Error('boom'));
  renderPopup();

  expect(await screen.findByText('Could not load the visits')).toBeInTheDocument();
});
