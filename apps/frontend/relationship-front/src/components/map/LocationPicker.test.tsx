import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Leaflet needs a real layout box to initialise, which jsdom cannot give it.
// The map is stubbed down to the behaviour this component actually drives:
// a click handler on the map, and a draggable marker.
let mapClick: ((event: { latlng: { lat: number; lng: number } }) => void) | undefined;
let markerDragEnd: ((event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void) | undefined;
let lastMarkerPosition: [number, number] | undefined;

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tiles" />,
  Marker: ({
    position,
    eventHandlers
  }: {
    position: [number, number];
    eventHandlers?: { dragend?: typeof markerDragEnd };
  }) => {
    lastMarkerPosition = position;
    markerDragEnd = eventHandlers?.dragend;
    return <div data-testid="marker" />;
  },
  useMapEvents: (handlers: { click?: typeof mapClick }) => {
    mapClick = handlers.click;
    return null;
  }
}));

vi.mock('../../services/geocoding', () => ({ searchPlaces: vi.fn() }));

import { searchPlaces } from '../../services/geocoding';
import LocationPicker from './LocationPicker';
import { Place } from '../../services/types';

const mockedSearch = searchPlaces as unknown as ReturnType<typeof vi.fn>;

const savedPlace: Place = {
  id: '59.4405,24.7453',
  label: 'Kolm Sõsarat',
  lat: 59.4405,
  lng: 24.7453,
  visits: 4,
  firstVisit: '2024-01-02',
  lastVisit: '2024-06-11',
  types: [{ typeId: 't1', name: 'Restaurants', slug: 'restaurants', count: 4 }]
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedSearch.mockResolvedValue([]);
  mapClick = undefined;
  markerDragEnd = undefined;
  lastMarkerPosition = undefined;
});

it('offers saved places without touching the geocoder', async () => {
  const user = userEvent.setup();
  render(<LocationPicker value={null} onChange={vi.fn()} savedPlaces={[savedPlace]} />);

  await user.click(screen.getByRole('combobox'));

  expect(await screen.findByText('Kolm Sõsarat')).toBeInTheDocument();
  expect(screen.getByText(/4 visits · last 2024-06-11/)).toBeInTheDocument();
  expect(mockedSearch).not.toHaveBeenCalled();
});

it('reports the picked saved place to the parent', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<LocationPicker value={null} onChange={onChange} savedPlaces={[savedPlace]} />);

  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByText('Kolm Sõsarat'));

  expect(onChange).toHaveBeenCalledWith({ label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 });
});

it('does not search the geocoder for fewer than 3 characters', async () => {
  const user = userEvent.setup();
  render(<LocationPicker value={null} onChange={vi.fn()} savedPlaces={[]} />);

  await user.type(screen.getByRole('combobox'), 'ko');

  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(mockedSearch).not.toHaveBeenCalled();
});

it('searches the geocoder once the query is long enough and lists the hits', async () => {
  const user = userEvent.setup();
  mockedSearch.mockResolvedValue([
    { label: 'Vabaduse väljak', lat: 59.433, lng: 24.745, detail: 'Vabaduse väljak, Tallinn' }
  ]);
  render(<LocationPicker value={null} onChange={vi.fn()} savedPlaces={[]} />);

  await user.type(screen.getByRole('combobox'), 'vabaduse');

  expect(await screen.findByText('Vabaduse väljak')).toBeInTheDocument();
  await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('vabaduse', expect.anything()));
});

it('hides a geocoder hit that duplicates an already-saved place', async () => {
  const user = userEvent.setup();
  mockedSearch.mockResolvedValue([
    { label: 'Kolm Sõsarat (OSM)', lat: 59.44051, lng: 24.74533, detail: 'same spot' }
  ]);
  render(<LocationPicker value={null} onChange={vi.fn()} savedPlaces={[savedPlace]} />);

  await user.type(screen.getByRole('combobox'), 'kolm');

  await waitFor(() => expect(mockedSearch).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText('Kolm Sõsarat (OSM)')).not.toBeInTheDocument());
  expect(screen.getByText('Kolm Sõsarat')).toBeInTheDocument();
});

it('shows the map and the current coordinates once a place is set', () => {
  render(
    <LocationPicker
      value={{ label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }}
      onChange={vi.fn()}
      savedPlaces={[]}
    />
  );

  expect(screen.getByTestId('map')).toBeInTheDocument();
  expect(screen.getByTestId('marker')).toBeInTheDocument();
  expect(screen.getByText(/Kolm Sõsarat · 59.4405, 24.7453/)).toBeInTheDocument();
});

it('opens the map on request when no place is set yet', async () => {
  const user = userEvent.setup();
  render(<LocationPicker value={null} onChange={vi.fn()} savedPlaces={[]} />);

  expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /drop a pin on the map/i }));

  expect(screen.getByTestId('map')).toBeInTheDocument();
  expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
});

it('places a pin where the map is clicked, naming it when no place is set', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<LocationPicker value={null} onChange={onChange} savedPlaces={[]} />);

  await user.click(screen.getByRole('button', { name: /drop a pin on the map/i }));
  mapClick?.({ latlng: { lat: 10, lng: 20 } });

  expect(onChange).toHaveBeenCalledWith({ label: 'Dropped pin', lat: 10, lng: 20 });
});

it('keeps the existing label when the pin is moved', () => {
  const onChange = vi.fn();
  render(
    <LocationPicker
      value={{ label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }}
      onChange={onChange}
      savedPlaces={[]}
    />
  );

  markerDragEnd?.({ target: { getLatLng: () => ({ lat: 59.5, lng: 24.8 }) } });

  expect(onChange).toHaveBeenCalledWith({ label: 'Kolm Sõsarat', lat: 59.5, lng: 24.8 });
  expect(lastMarkerPosition).toEqual([59.4405, 24.7453]);
});

it('clears the place and closes the map', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <LocationPicker
      value={{ label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }}
      onChange={onChange}
      savedPlaces={[]}
    />
  );

  await user.click(screen.getByRole('button', { name: /remove this place/i }));

  expect(onChange).toHaveBeenCalledWith(null);
});

it('uses the supplied label for the field', () => {
  render(<LocationPicker value={null} onChange={vi.fn()} savedPlaces={[]} label="Place 2" />);

  expect(screen.getByLabelText('Place 2')).toBeInTheDocument();
});
