import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The map stands in as its points: a button to drag each draggable one a
// little, a button for a point that takes taps, and a tap on the map.
vi.mock('./LiveMap', () => ({
  default: ({
    points,
    onMapClick
  }: {
    points: Array<{
      id: string;
      label: string;
      lat: number;
      lng: number;
      onMove?: (point: { lat: number; lng: number }) => void;
      onClick?: () => void;
    }>;
    onMapClick?: (point: { lat: number; lng: number }) => void;
  }) => (
    <div data-testid="live-map">
      {points.map((point) => (
        <span key={point.id} data-testid={`point-${point.id}`}>
          {point.label}
          {point.onMove && (
            <button type="button" onClick={() => point.onMove?.({ lat: point.lat + 0.01, lng: point.lng })}>
              drag {point.id}
            </button>
          )}
          {point.onClick && (
            <button type="button" onClick={point.onClick}>
              tap {point.id}
            </button>
          )}
        </span>
      ))}
      {onMapClick && (
        <button type="button" onClick={() => onMapClick({ lat: 59.45, lng: 24.75 })}>
          tap the map
        </button>
      )}
    </div>
  )
}));
const where = vi.hoisted(() => ({ currentPosition: vi.fn() }));
vi.mock('../../services/live', async (original) => ({
  ...(await original<typeof import('../../services/live')>()),
  currentPosition: where.currentPosition
}));
// Addresses answer at once: Kaupmehe 7 near where the phone is, Viru 4 anywhere else.
vi.mock('../../hooks/usePlaceAt', async (original) => ({
  ...(await original<typeof import('../../hooks/usePlaceAt')>()),
  usePlaceAt: (point: { lat: number; lng: number } | null) =>
    point
      ? Math.abs(point.lat - 59.4) < 0.001
        ? { name: 'Kaupmehe 7', detail: 'Tallinn', ...point }
        : { name: 'Viru 4', detail: 'Tallinn', ...point }
      : null
}));
const api = vi.hoisted(() => ({
  listSavedPlaces: vi.fn(),
  savePlace: vi.fn(),
  deleteSavedPlace: vi.fn(),
  searchPlaces: vi.fn()
}));
vi.mock('../../services/chatApi', () => ({ chatApi: api }));

import { DriveScreen } from './DriveScreen';
import type { UseDriveShareResult } from '../../hooks/useDriveShare';
import type { ConversationMember, LiveShare, SavedPlace } from '../../types';

const drive = (overrides: Partial<UseDriveShareResult> = {}): UseDriveShareResult => ({
  state: 'idle',
  error: null,
  position: null,
  lastSentAt: null,
  sendFailing: false,
  screen: null,
  pinned: false,
  start: vi.fn(async () => {}),
  stop: vi.fn(),
  ...overrides
});

const share = (overrides: Partial<LiveShare> = {}): LiveShare => ({
  userId: 'u-tom',
  name: 'Tom',
  position: null,
  destination: null,
  fixed: false,
  pinLabel: null,
  startedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  watchers: [],
  ...overrides
});

const HOME: SavedPlace = { id: 'p-home', name: 'Home', lat: 59.5, lng: 24.8, address: 'Viru 4, Tallinn' };
const here = { coords: { latitude: 59.4, longitude: 24.75, accuracy: 12 } } as GeolocationPosition;

const IRJA: ConversationMember = {
  userId: 'u-irja',
  email: 'irja@example.com',
  name: 'Irja',
  picture: 'https://example.com/irja.jpg',
  joinedAt: new Date().toISOString()
};

/** Where each test's map gets its people from; the caller's own share is on the list as the server has it. */
const theMap = (props: Partial<Parameters<typeof DriveScreen>[0]> = {}) => ({
  shares: props.share ? [props.share] : [],
  members: [IRJA],
  currentUserId: 'u-tom'
});

const open = (props: Partial<Parameters<typeof DriveScreen>[0]> = {}) =>
  render(
    <DriveScreen
      open
      onClose={() => {}}
      conversationId="c1"
      drive={drive()}
      share={null}
      audience="Irja"
      {...theMap(props)}
      {...props}
    />
  );

beforeEach(() => {
  where.currentPosition.mockReset().mockResolvedValue(here);
  Object.values(api).forEach((fn) => fn.mockReset());
  api.listSavedPlaces.mockResolvedValue([]);
  api.searchPlaces.mockResolvedValue([]);
});

describe('choosing', () => {
  it('ignores an old GPS lookup after the map is reopened', async () => {
    let finish!: (position: GeolocationPosition) => void;
    where.currentPosition.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const start = vi.fn(async () => {});
    const props = {
      onClose: () => {},
      conversationId: 'c1',
      drive: drive({ start }),
      share: null,
      audience: 'Irja',
      ...theMap()
    };
    const { rerender } = render(<DriveScreen open {...props} />);
    rerender(<DriveScreen open={false} {...props} />);
    rerender(<DriveScreen open {...props} />);
    await screen.findByTestId('point-me');

    const oldPosition = { coords: { latitude: 59.8, longitude: 24.75, accuracy: 12 } } as GeolocationPosition;
    await act(async () => finish(oldPosition));
    await userEvent.click(screen.getByRole('button', { name: 'Send pin' }));

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ place: { lat: 59.4, lng: 24.75 } }));
  });

  it('opens on a map of where the phone is, with its address', async () => {
    open();

    expect(screen.getByText(/Finding where you are/)).toBeInTheDocument();
    expect(await screen.findByTestId('point-me')).toHaveTextContent('You');
    expect(
      screen.getByRole('button', { name: 'From: Your location, Kaupmehe 7, Tallinn. Change' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^To: Where to\?/ })).toBeInTheDocument();
  });

  it('shares live from where the phone is', async () => {
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Share live' }));

    expect(start).toHaveBeenCalledWith({ destination: null, place: { lat: 59.4, lng: 24.75, accuracy: 12 } });
  });

  it('sets From on a map click and keeps the destination selected before it', async () => {
    api.listSavedPlaces.mockResolvedValue([HOME]);
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Home' }));
    await userEvent.click(screen.getByRole('button', { name: /^From:/ }));
    expect(screen.getByRole('combobox', { name: 'From' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'tap the map' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'From: Viru 4, Tallinn. Change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^To: Home/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send pin' }));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        place: { lat: 59.45, lng: 24.75, label: null },
        pinLabel: 'Viru 4, Tallinn',
        destination: { lat: 59.5, lng: 24.8, label: 'Home' }
      })
    );
  });

  it('shows an interactive map while GPS is pending and never overwrites a manually chosen From', async () => {
    let locate!: (position: GeolocationPosition) => void;
    where.currentPosition.mockReturnValueOnce(
      new Promise<GeolocationPosition>((resolve) => {
        locate = resolve;
      })
    );
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });
    expect(await screen.findByTestId('live-map')).toBeInTheDocument();
    expect(screen.queryByTestId('point-me')).not.toBeInTheDocument();
    expect(where.currentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 8_000
    });
    await userEvent.click(screen.getByRole('button', { name: /^From:/ }));
    await userEvent.click(screen.getByRole('button', { name: 'tap the map' }));
    expect(screen.getByRole('button', { name: 'Send pin' })).toBeEnabled();
    await act(async () => {
      locate(here);
    });
    expect(screen.getByRole('button', { name: 'From: Viru 4, Tallinn. Change' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send pin' }));
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ place: { lat: 59.45, lng: 24.75, label: null } }));
  });

  it('sends a pin of where the phone is, called by its address', async () => {
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Send pin' }));

    expect(start).toHaveBeenCalledWith({
      destination: null,
      place: { lat: 59.4, lng: 24.75 },
      pin: true,
      pinLabel: 'Kaupmehe 7, Tallinn'
    });
  });

  it('drops the destination with a tap on the map, and takes it away with a tap on it', async () => {
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    await userEvent.click(await screen.findByRole('button', { name: 'tap the map' }));

    expect(screen.getByTestId('point-destination')).toHaveTextContent('Viru 4, Tallinn');
    await userEvent.click(screen.getByRole('button', { name: 'Share live' }));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ destination: { lat: 59.45, lng: 24.75, label: 'Viru 4, Tallinn' } })
    );

    await userEvent.click(screen.getByRole('button', { name: 'tap destination' }));
    expect(screen.queryByTestId('point-destination')).not.toBeInTheDocument();
  });

  it('moves the destination by dragging it, and clears it from its line', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'tap the map' }));
    await userEvent.click(screen.getByRole('button', { name: 'drag destination' }));

    expect(screen.getByTestId('point-destination')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear to' }));
    expect(screen.queryByTestId('point-destination')).not.toBeInTheDocument();
  });

  it('moves you by dragging your dot for a pin, while live still follows the phone', async () => {
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    await userEvent.click(await screen.findByRole('button', { name: 'drag me' }));

    expect(screen.getByRole('button', { name: 'From: Viru 4, Tallinn. Change' })).toBeInTheDocument();
    expect(screen.getByText(/Live follows your phone, not the place you set/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send pin' }));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ place: { lat: 59.41, lng: 24.75, label: null }, pin: true })
    );

    // A stray drag never takes live sharing away: it starts from where the phone is.
    await userEvent.click(screen.getByRole('button', { name: 'Share live' }));
    expect(start).toHaveBeenLastCalledWith({ destination: null, place: { lat: 59.4, lng: 24.75, accuracy: 12 } });

    await userEvent.click(screen.getByRole('button', { name: 'Clear from' }));
    expect(screen.getByText(/Live follows you while you drive/)).toBeInTheDocument();
  });

  it('starts live without a first fix by asking the GPS itself', async () => {
    where.currentPosition.mockRejectedValue(new Error('Could not find where you are in time.'));
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    await screen.findByText(/Could not find where you are in time\./);
    await userEvent.click(screen.getByRole('button', { name: 'Share live' }));

    expect(start).toHaveBeenCalledWith({ destination: null, place: null });
  });

  it('says when the browser only guessed, and how to put it right', async () => {
    where.currentPosition.mockResolvedValue({ coords: { latitude: 59.4, longitude: 24.75, accuracy: 3200 } });
    open();

    expect(await screen.findByText(/may be off by about 3.2 km\. Drag your dot to where you are/)).toBeInTheDocument();
  });

  it('picks a saved place as the destination with one tap', async () => {
    api.listSavedPlaces.mockResolvedValue([HOME]);
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Home' }));

    expect(screen.getByRole('button', { name: 'To: Home, Viru 4, Tallinn. Change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Share live' }));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ destination: { lat: 59.5, lng: 24.8, label: 'Home' } })
    );
  });

  it('saves a place under a name, for both of you to pick next time', async () => {
    api.savePlace.mockResolvedValue({
      id: 'p-gym',
      name: 'Gym',
      lat: 59.4,
      lng: 24.75,
      address: 'Kaupmehe 7, Tallinn'
    });
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Save this place' }));
    expect(screen.getByRole('dialog', { name: 'Save this place' })).toHaveTextContent('Kaupmehe 7, Tallinn');
    await userEvent.type(screen.getByLabelText('Name'), 'Gym');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.savePlace).toHaveBeenCalledWith('c1', {
      name: 'Gym',
      lat: 59.4,
      lng: 24.75,
      address: 'Kaupmehe 7, Tallinn'
    });
    expect(await screen.findByRole('button', { name: 'Gym' })).toBeInTheDocument();
  });

  it('deletes a saved place once asked twice', async () => {
    api.listSavedPlaces.mockResolvedValue([HOME]);
    api.deleteSavedPlace.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    open();
    const chips = await screen.findByRole('group', { name: 'Saved places' });

    await userEvent.click(within(chips).getByTestId('CancelIcon'));
    expect(api.deleteSavedPlace).not.toHaveBeenCalled();
    await userEvent.click(within(chips).getByTestId('CancelIcon'));

    expect(api.deleteSavedPlace).toHaveBeenCalledWith('c1', 'p-home');
    expect(screen.queryByRole('group', { name: 'Saved places' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('says so when a saved place cannot be deleted', async () => {
    api.listSavedPlaces.mockResolvedValue([HOME]);
    api.deleteSavedPlace.mockRejectedValue(new Error('offline'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    open();

    await userEvent.click(within(await screen.findByRole('group', { name: 'Saved places' })).getByTestId('CancelIcon'));

    expect(await screen.findByText('Could not delete that place. Try again.')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('says why it cannot find the phone, and tries again', async () => {
    where.currentPosition.mockRejectedValueOnce(new Error('Location is blocked.'));
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('Location is blocked.');
    expect(screen.getByRole('button', { name: 'Send pin' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('point-me')).toBeInTheDocument();
  });

  it('with no idea where the phone is, a tap on the map says where you are', async () => {
    where.currentPosition.mockRejectedValue(new Error('Location is blocked.'));
    const start = vi.fn(async () => {});
    open({ drive: drive({ start }) });

    expect(await screen.findByText(/Tap the map where you are, or search for it/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'tap the map' }));

    expect(screen.getByTestId('point-me')).toBeInTheDocument();
    expect(screen.queryByTestId('point-destination')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send pin' }));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ place: { lat: 59.45, lng: 24.75, label: null }, pin: true })
    );
  });

  it('says why it could not start', () => {
    open({ drive: drive({ error: 'Could not start sharing. Try again.' }) });
    expect(screen.getByText('Could not start sharing. Try again.')).toBeInTheDocument();
  });
});

describe('a pin', () => {
  it('shows the pin by its name and takes it down', async () => {
    const stop = vi.fn();
    open({
      drive: drive({ state: 'sharing', pinned: true, position: { lat: 59.4, lng: 24.7, at: Date.now() }, stop }),
      share: share({ fixed: true, pinLabel: 'Kaupmehe 7' })
    });

    expect(screen.getByText('Pin shared with Irja')).toBeInTheDocument();
    expect(await screen.findByTestId('point-me')).toHaveTextContent('Kaupmehe 7');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Irja sees this pin for up to four hours, or until you remove it. Tumbaland can be closed.'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove pin' }));
    expect(stop).toHaveBeenCalled();
  });

  it('is still a pin after a reload, with nothing sending', async () => {
    open({
      share: share({
        fixed: true,
        position: { lat: 59.4, lng: 24.7, accuracy: null, heading: null, speed: null, at: new Date().toISOString() }
      })
    });

    expect(await screen.findByTestId('live-map')).toHaveTextContent('You');
    expect(screen.getByRole('button', { name: 'Remove pin' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep sending' })).not.toBeInTheDocument();
  });
});

describe('a share this phone is not sending', () => {
  it('offers to carry on, keeping its destination, or to stop', async () => {
    const start = vi.fn(async () => {});
    const stop = vi.fn();
    open({ drive: drive({ start, stop }), share: share() });

    await userEvent.click(screen.getByRole('button', { name: 'Keep sending' }));
    expect(start).toHaveBeenCalledWith();
    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(stop).toHaveBeenCalled();
    expect(where.currentPosition).not.toHaveBeenCalled();
  });
});

describe('sharing', () => {
  it('warns when this phone has stopped receiving GPS fixes', () => {
    open({
      drive: drive({ state: 'sharing', position: { lat: 59.4, lng: 24.7, at: Date.now() - 120_000 } }),
      share: share()
    });
    expect(screen.getByText(/Waiting for a fresh GPS position/)).toBeInTheDocument();
  });

  it('shows the map with the destination, how far is left to it, and who is waiting', async () => {
    const stop = vi.fn();
    open({
      drive: drive({
        state: 'sharing',
        position: { lat: 59.4, lng: 24.7, speed: 14, at: Date.now() },
        lastSentAt: Date.now(),
        screen: 'unavailable',
        stop
      }),
      share: share({
        destination: { lat: 59.45, lng: 24.75, label: 'Home', distanceM: 8100 },
        watchers: [{ userId: 'u-irja', name: 'Irja', radiusM: 1000, distanceM: 3200, notified: false }]
      })
    });

    expect(await screen.findByTestId('point-destination')).toHaveTextContent('Home');
    expect(screen.getByRole('status')).toHaveTextContent('Sent just now · 8.1 km to Home · 50 km/h');
    expect(screen.getByText('Irja is told at 1.0 km · 3.2 km away')).toBeInTheDocument();
    expect(screen.getByText(/will not keep the screen on/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(stop).toHaveBeenCalled();
  });

  it('says when positions are not getting through, and when someone has been told', () => {
    open({
      drive: drive({ state: 'sharing', position: { lat: 59.4, lng: 24.7, at: Date.now() }, sendFailing: true }),
      share: share({ watchers: [{ userId: 'u-irja', name: 'Irja', radiusM: 1000, distanceM: 400, notified: true }] })
    });

    expect(screen.getByRole('status')).toHaveTextContent('Not getting through. Still trying');
    expect(screen.getByText('Irja has been told you are close')).toBeInTheDocument();
  });
});

describe('when the other is sharing too', () => {
  const irja = (overrides: Partial<LiveShare> = {}) =>
    share({
      userId: 'u-irja',
      name: 'Irja',
      position: { lat: 59.41, lng: 24.7, accuracy: 10, heading: null, speed: null, at: new Date().toISOString() },
      ...overrides
    });
  const mine = (overrides: Partial<LiveShare> = {}) => share({ ...overrides });

  it('puts them on the map beside you while you share live, and says how far apart you are', async () => {
    open({
      drive: drive({ state: 'sharing', position: { lat: 59.4, lng: 24.7, at: Date.now() } }),
      share: mine(),
      shares: [mine(), irja()]
    });

    expect(await screen.findByTestId('point-me')).toBeInTheDocument();
    expect(screen.getByTestId('point-u-irja')).toHaveTextContent('Irja');
    expect(screen.getByRole('status')).toHaveTextContent('Irja is 1.1 km away');
  });

  it('keeps their destination apart from yours', async () => {
    open({
      drive: drive({ state: 'sharing', position: { lat: 59.4, lng: 24.7, at: Date.now() } }),
      share: mine({ destination: { lat: 59.45, lng: 24.75, label: 'Home', distanceM: 8100 } }),
      shares: [
        mine({ destination: { lat: 59.45, lng: 24.75, label: 'Home', distanceM: 8100 } }),
        irja({ destination: { lat: 59.5, lng: 24.8, label: 'Store', distanceM: 100 } })
      ]
    });

    expect(await screen.findByTestId('point-destination')).toHaveTextContent('Home');
    expect(screen.getByTestId('point-destination:u-irja')).toHaveTextContent('Store');
  });

  it('does not tell a distance to a position that has gone stale', async () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    open({
      drive: drive({ state: 'sharing', position: { lat: 59.4, lng: 24.7, at: Date.now() } }),
      share: mine(),
      shares: [mine(), irja({ position: { ...irja().position!, at: old } })]
    });

    await screen.findByTestId('point-u-irja');
    expect(screen.getByRole('status')).not.toHaveTextContent('away');
  });

  it('shows them while you are still choosing where to go, saying whose pin it is', async () => {
    open({ shares: [irja({ fixed: true, pinLabel: 'The store' })] });

    expect(await screen.findByTestId('point-u-irja')).toHaveTextContent('Irja: The store');
  });

  it('tells no distance from a GPS fix of your own that has gone old', async () => {
    open({
      drive: drive({ state: 'sharing', position: { lat: 59.4, lng: 24.7, at: Date.now() - 120_000 } }),
      share: mine(),
      shares: [mine(), irja()]
    });

    await screen.findByTestId('point-u-irja');
    expect(screen.getByRole('status')).not.toHaveTextContent('away');
  });
});
