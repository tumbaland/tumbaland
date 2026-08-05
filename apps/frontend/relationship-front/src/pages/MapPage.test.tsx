import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

// jsdom gives Leaflet no layout box, so the map is stubbed; what matters here
// is which pins are rendered and how the bounds are fitted.
let fittedPositions: [number, number][] = [];

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tiles" />,
  Marker: ({ position, children }: { position: [number, number]; children?: React.ReactNode }) => {
    fittedPositions.push(position);
    return <div data-testid="marker">{children}</div>;
  },
  Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() })
}));

vi.mock('../services/places', () => ({ getPlaces: vi.fn(), getPlaceVisits: vi.fn() }));
vi.mock('../services/activityTypes', () => ({ getActivityTypes: vi.fn() }));

import { getPlaces, getPlaceVisits } from '../services/places';
import { getActivityTypes } from '../services/activityTypes';
import MapPage from './MapPage';
import { Place } from '../services/types';

const mockedGetPlaces = getPlaces as unknown as ReturnType<typeof vi.fn>;
const mockedGetVisits = getPlaceVisits as unknown as ReturnType<typeof vi.fn>;
const mockedGetTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;

const restaurantType = {
  _id: 't1',
  id: 't1',
  name: 'Restaurants',
  slug: 'restaurants',
  color: '#FF5733',
  hasLocation: true,
  isActive: true,
  sortOrder: 0,
  createdAt: '',
  updatedAt: '',
  userId: 'u1'
};
const plainType = { ...restaurantType, _id: 't2', id: 't2', name: 'Reading', slug: 'reading', hasLocation: false };

const place = (over: Partial<Place> = {}): Place => ({
  id: '59.4405,24.7453',
  label: 'Kolm Sõsarat',
  lat: 59.4405,
  lng: 24.7453,
  visits: 3,
  firstVisit: '2024-01-02',
  lastVisit: '2024-06-11',
  types: [{ typeId: 't1', name: 'Restaurants', slug: 'restaurants', color: '#FF5733', count: 3 }],
  ...over
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fittedPositions = [];
  mockedGetTypes.mockResolvedValue({ data: [restaurantType, plainType], pagination: {} });
  mockedGetPlaces.mockResolvedValue([]);
  mockedGetVisits.mockResolvedValue([]);
});

it('shows a spinner while the places load', () => {
  mockedGetPlaces.mockReturnValue(new Promise(() => {}));
  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('prompts how to get started when nothing is logged yet', async () => {
  renderPage();

  expect(await screen.findByText('No places logged yet')).toBeInTheDocument();
  expect(screen.getByText(/Track where it happened/)).toBeInTheDocument();
});

it('shows an error when the places cannot be loaded', async () => {
  mockedGetPlaces.mockRejectedValue(new Error('boom'));
  renderPage();

  expect(await screen.findByText('Failed to load the map')).toBeInTheDocument();
});

it('renders a pin per place and summarises the totals', async () => {
  mockedGetPlaces.mockResolvedValue([
    place(),
    place({ id: '59.5,24.8', label: 'Vabaduse väljak', lat: 59.5, lng: 24.8, visits: 2 })
  ]);
  renderPage();

  await waitFor(() => expect(screen.getAllByTestId('marker')).toHaveLength(2));
  expect(screen.getByText('2 places · 5 visits')).toBeInTheDocument();
  expect(fittedPositions).toEqual([
    [59.4405, 24.7453],
    [59.5, 24.8]
  ]);
});

it('uses singular wording for one place visited once', async () => {
  mockedGetPlaces.mockResolvedValue([place({ visits: 1 })]);
  renderPage();

  expect(await screen.findByText('1 place · 1 visit')).toBeInTheDocument();
});

it('scopes the request to the current tenant group', async () => {
  renderPage();

  await waitFor(() =>
    expect(mockedGetPlaces).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }))
  );
});

it('only offers activity types that track a location', async () => {
  const user = userEvent.setup();
  renderPage();

  await waitFor(() => expect(mockedGetTypes).toHaveBeenCalled());
  await user.click(screen.getByLabelText('Activity'));

  const listbox = await screen.findByRole('listbox');
  expect(within(listbox).getByText('Restaurants')).toBeInTheDocument();
  expect(within(listbox).queryByText('Reading')).not.toBeInTheDocument();
});

it('refetches with the chosen activity type', async () => {
  const user = userEvent.setup();
  renderPage();

  await waitFor(() => expect(mockedGetTypes).toHaveBeenCalled());
  await user.click(screen.getByLabelText('Activity'));
  await user.click(within(await screen.findByRole('listbox')).getByText('Restaurants'));

  await waitFor(() =>
    expect(mockedGetPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ typeId: 't1' }))
  );
});

it.each([
  ['This year', (year: number) => ({ startDate: `${year}-01-01`, endDate: `${year}-12-31` })],
  ['Last year', (year: number) => ({ startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` })]
])('refetches with the %s date range', async (label, expected) => {
  const user = userEvent.setup();
  renderPage();

  await waitFor(() => expect(mockedGetPlaces).toHaveBeenCalled());
  await user.click(screen.getByLabelText('When'));
  await user.click(within(await screen.findByRole('listbox')).getByText(label));

  await waitFor(() =>
    expect(mockedGetPlaces).toHaveBeenLastCalledWith(
      expect.objectContaining(expected(new Date().getFullYear()))
    )
  );
});

it('sends only a start date for the rolling 90-day range', async () => {
  const user = userEvent.setup();
  renderPage();

  await waitFor(() => expect(mockedGetPlaces).toHaveBeenCalled());
  await user.click(screen.getByLabelText('When'));
  await user.click(within(await screen.findByRole('listbox')).getByText('Last 90 days'));

  await waitFor(() => {
    const last = mockedGetPlaces.mock.lastCall?.[0];
    expect(last.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(last.endDate).toBeUndefined();
  });
});

it('reports when filters exclude every place', async () => {
  const user = userEvent.setup();
  mockedGetPlaces.mockResolvedValue([]);
  renderPage();

  await waitFor(() => expect(mockedGetTypes).toHaveBeenCalled());
  await user.click(screen.getByLabelText('Activity'));
  await user.click(within(await screen.findByRole('listbox')).getByText('Restaurants'));

  expect(await screen.findByText('No places match these filters')).toBeInTheDocument();
});

it('lists the busiest places as chips beneath the map', async () => {
  mockedGetPlaces.mockResolvedValue([place()]);
  renderPage();

  expect(await screen.findByText('Kolm Sõsarat · 3')).toBeInTheDocument();
});
