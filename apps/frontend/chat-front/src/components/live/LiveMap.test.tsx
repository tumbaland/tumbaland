import { describe, expect, it, vi } from 'vite-plus/test';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type L from 'leaflet';

// Leaflet needs a real layout box, which jsdom cannot give it. The map is
// stubbed down to what this component drives: the view it sets, a drag, a
// tap, and markers that can be dragged or tapped.
const setView = vi.fn();
const fitBounds = vi.fn();
let handlers: { dragstart?: () => void; click?: (event: { latlng: { lat: number; lng: number } }) => void } = {};
const markerFrames: Array<{ position: unknown; icon: unknown; eventHandlers: unknown }> = [];
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: () => <div data-testid="accuracy" />,
  Marker: ({
    children,
    draggable,
    eventHandlers,
    position,
    icon
  }: {
    position: unknown;
    icon: unknown;
    children?: React.ReactNode;
    draggable?: boolean;
    eventHandlers?: {
      click?: () => void;
      dragend?: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void;
    };
  }) => {
    markerFrames.push({ position, icon, eventHandlers });
    return (
      <div data-testid="marker" data-draggable={String(Boolean(draggable))}>
        {children}
        {eventHandlers?.click && (
          <button type="button" onClick={eventHandlers.click}>
            tap marker
          </button>
        )}
        {draggable && eventHandlers?.dragend && (
          <button
            type="button"
            onClick={() => eventHandlers.dragend?.({ target: { getLatLng: () => ({ lat: 59.5, lng: 24.9 }) } })}
          >
            drop marker
          </button>
        )}
      </div>
    );
  },
  Tooltip: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  useMap: () => ({ setView, fitBounds, getZoom: () => 15 }),
  useMapEvents: (given: typeof handlers) => {
    handlers = given;
    return null;
  }
}));

// The background is MapLibre, which needs WebGL; it has tests of its own.
vi.mock('./MapTiles', () => ({ MapTiles: () => null }));

import LiveMap from './LiveMap';
import type { MapPoint } from './LiveMap';

const me = (lat: number, accuracy = 30) => ({ id: 'me', lat, lng: 24.7, accuracy, color: '#e91e63', label: 'Tom' });
const destination = {
  id: 'destination',
  lat: 59.5,
  lng: 24.8,
  color: '#2e7d32',
  label: 'Home',
  kind: 'place' as const
};

describe('LiveMap', () => {
  it('draws each point with its name, and how sure the phone is', () => {
    render(<LiveMap points={[me(59.4), destination]} />);
    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getAllByTestId('accuracy')).toHaveLength(1);
  });

  it('leaves out an accuracy too poor to mean anything', () => {
    render(<LiveMap points={[me(59.4, 5000)]} />);
    expect(screen.queryByTestId('accuracy')).not.toBeInTheDocument();
  });

  it('follows one person as they move, until the map is dragged, and again on Follow', async () => {
    setView.mockClear();
    const { rerender } = render(<LiveMap points={[me(59.4)]} />);
    rerender(<LiveMap points={[me(59.41)]} />);
    expect(setView).toHaveBeenLastCalledWith([59.41, 24.7], 15, { animate: true });

    act(() => handlers.dragstart?.());
    setView.mockClear();
    rerender(<LiveMap points={[me(59.42)]} />);
    expect(setView).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(setView).toHaveBeenLastCalledWith([59.42, 24.7], 15, { animate: true });
  });

  it('keeps the person and the destination both in view', () => {
    fitBounds.mockClear();
    render(<LiveMap points={[me(59.4), destination]} />);
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [59.4, 24.7],
        [59.5, 24.8]
      ],
      expect.objectContaining({ maxZoom: 15 })
    );
  });

  it('stays put for marking places, hands taps on the map over, and goes to a place it is asked to', () => {
    setView.mockClear();
    fitBounds.mockClear();
    const onMapClick = vi.fn();
    const { rerender } = render(<LiveMap points={[me(59.4), destination]} follow={false} onMapClick={onMapClick} />);

    act(() => handlers.click?.({ latlng: { lat: 59.45, lng: 24.9 } }));

    expect(onMapClick).toHaveBeenCalledWith({ lat: 59.45, lng: 24.9 });
    expect(setView).not.toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();

    rerender(
      <LiveMap
        points={[me(59.4), destination]}
        follow={false}
        onMapClick={onMapClick}
        focus={{ lat: 59.6, lng: 25, key: 1 }}
      />
    );
    expect(setView).toHaveBeenCalledWith([59.6, 25], 15, { animate: true });
  });

  it('lets a point be dragged, or tapped, where it is meant to be', async () => {
    const onMove = vi.fn();
    const onClick = vi.fn();
    render(
      <LiveMap
        points={[
          { ...me(59.4), onMove },
          { ...destination, onClick }
        ]}
        follow={false}
      />
    );

    const [mine, home] = screen.getAllByTestId('marker');
    expect(mine).toHaveAttribute('data-draggable', 'true');
    expect(home).toHaveAttribute('data-draggable', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'drop marker' }));
    await userEvent.click(within(home!).getByRole('button', { name: 'tap marker' }));

    expect(onMove).toHaveBeenCalledWith({ lat: 59.5, lng: 24.9 });
    expect(onClick).toHaveBeenCalled();
  });

  it('draws the map before GPS has given any position', () => {
    render(<LiveMap points={[]} follow={false} />);
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  });

  it('starts following when the choosing map becomes a live map', () => {
    const { rerender } = render(<LiveMap points={[me(59.4)]} follow={false} />);
    setView.mockClear();
    rerender(<LiveMap points={[me(59.41)]} follow />);
    expect(setView).toHaveBeenLastCalledWith([59.41, 24.7], 15, { animate: true });
    expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
  });

  it('keeps Leaflet from resetting a dragged marker when a clock or address causes a render', async () => {
    const firstMove = vi.fn();
    const nextMove = vi.fn();
    const { rerender } = render(<LiveMap points={[{ ...me(59.4), onMove: firstMove }]} follow={false} />);
    const before = markerFrames.at(-1)!;
    rerender(<LiveMap points={[{ ...me(59.4), label: 'An address just arrived', onMove: nextMove }]} follow={false} />);
    const after = markerFrames.at(-1)!;
    // React Leaflet calls setLatLng/setIcon whenever these prop references change.
    expect(after.position).toBe(before.position);
    expect(after.icon).toBe(before.icon);
    expect(after.eventHandlers).toBe(before.eventHandlers);
    await userEvent.click(screen.getByRole('button', { name: 'drop marker' }));
    expect(nextMove).toHaveBeenCalledWith({ lat: 59.5, lng: 24.9 });
    expect(firstMove).not.toHaveBeenCalled();
  });

  it('centres on the first GPS fix when the map opened before it arrived', () => {
    const { rerender } = render(<LiveMap points={[]} follow={false} />);
    setView.mockClear();
    rerender(<LiveMap points={[me(59.4)]} follow={false} />);
    expect(setView).toHaveBeenCalledWith([59.4, 24.7], 15, { animate: true });
  });

  it('keeps the chosen map view if the person pans while GPS is pending', () => {
    const { rerender } = render(<LiveMap points={[]} follow={false} />);
    act(() => handlers.dragstart?.());
    setView.mockClear();
    rerender(<LiveMap points={[me(59.4)]} follow={false} />);
    expect(setView).not.toHaveBeenCalled();
  });

  describe('who is who', () => {
    const iconOf = (point: MapPoint) => {
      render(<LiveMap points={[point]} follow={false} />);
      return (markerFrames.at(-1)!.icon as L.DivIcon).options;
    };

    it('draws a person as their photo, with their initial underneath until it arrives', () => {
      const options = iconOf({ ...me(59.4), picture: 'https://example.com/tom.jpg', initial: 'T' });
      const html = options.html as HTMLElement;
      expect(options.className).toBe('tumbaland-live-photo');
      expect(html.querySelector('img')).toHaveAttribute('src', 'https://example.com/tom.jpg');
      expect(html.textContent).toBe('T');
    });

    it('keeps the initial when there is no photo', () => {
      const options = iconOf({ ...me(59.4), picture: null, initial: 'T' });
      const html = options.html as HTMLElement;
      expect(html.querySelector('img')).toBeNull();
      expect(html.textContent).toBe('T');
    });

    it('drops a photo that fails to load, leaving the initial', () => {
      const html = iconOf({ ...me(59.4), picture: 'https://example.com/gone.jpg', initial: 'T' }).html as HTMLElement;
      const image = html.querySelector('img')!;
      image.onerror?.(new Event('error'));
      expect(html.querySelector('img')).toBeNull();
      expect(html.textContent).toBe('T');
    });

    it('does not put a picture address into markup', () => {
      const html = iconOf({ ...me(59.4), picture: '"><script>alert(1)</script>', initial: 'T' }).html as HTMLElement;
      expect(html.querySelector('script')).toBeNull();
    });

    it('fades and greys someone who has not been heard from', () => {
      const live = iconOf({ ...me(59.4), initial: 'T' }).html as HTMLElement;
      expect(live.style.opacity).toBe('');
      const stale = iconOf({ ...me(59.4), id: 'old', initial: 'T', stale: true }).html as HTMLElement;
      expect(stale.style.opacity).toBe('0.65');
      expect(stale.style.filter).toBe('grayscale(1)');
    });

    it('keeps places as pins', () => {
      const options = iconOf(destination);
      expect(options.className).toBe('tumbaland-live-pin');
      expect(options.html).toContain('<svg');
    });
  });
});
