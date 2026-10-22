import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./LiveMap', () => ({ default: () => <div data-testid="live-map" /> }));
const api = vi.hoisted(() => ({ watchLive: vi.fn(), unwatchLive: vi.fn() }));
vi.mock('../../services/chatApi', () => ({ chatApi: api }));
const where = vi.hoisted(() => ({ currentPosition: vi.fn() }));
vi.mock('../../services/live', async (original) => ({
  ...(await original<typeof import('../../services/live')>()),
  currentPosition: where.currentPosition
}));

// A pin's address answers at once.
vi.mock('../../hooks/usePlaceAt', async (original) => ({
  ...(await original<typeof import('../../hooks/usePlaceAt')>()),
  usePlaceAt: (point: { lat: number; lng: number } | null) =>
    point ? { name: 'Kaupmehe 7', detail: 'Tallinn', ...point } : null
}));

import { LiveViewer } from './LiveViewer';
import type { LiveShare } from '../../types';

const share = (overrides: Partial<LiveShare> = {}): LiveShare => ({
  userId: 'u-tom',
  name: 'Tom',
  position: { lat: 59.4, lng: 24.7, accuracy: 8, heading: null, speed: 14, at: new Date().toISOString() },
  startedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  destination: null,
  fixed: false,
  pinLabel: null,
  watchers: [],
  ...overrides
});

const open = (props: Partial<Parameters<typeof LiveViewer>[0]> = {}) =>
  render(
    <LiveViewer
      open
      onClose={() => {}}
      conversationId="c1"
      share={share()}
      currentUserId="u-irja"
      onShareChange={() => {}}
      {...props}
    />
  );

beforeEach(() => {
  api.watchLive.mockReset();
  api.unwatchLive.mockReset();
  where.currentPosition.mockReset().mockResolvedValue({ coords: { latitude: 59.43, longitude: 24.75 } });
});

describe('LiveViewer', () => {
  it('shows where they are and how fresh it is', async () => {
    open();
    expect(await screen.findByTestId('live-map')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Updated just now · 50 km/h');
  });

  it('shows where they are heading, and how far is left', async () => {
    open({ share: share({ destination: { lat: 59.5, lng: 24.8, label: null, distanceM: 8100 } }) });
    expect(screen.getByRole('status')).toHaveTextContent('Updated just now · 8.1 km to go · 50 km/h');
  });

  it('shows a pin as a pin, never as old', () => {
    open({
      share: share({
        fixed: true,
        position: { ...share().position!, speed: null, at: new Date(Date.now() - 20 * 60_000).toISOString() }
      })
    });
    expect(screen.getByRole('status')).toHaveTextContent('Pin shared 20 min ago');
    expect(screen.queryByText(/screen may be off/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'How close' })).not.toBeInTheDocument();
  });

  it('names the pin and where they are heading', () => {
    open({
      share: share({
        fixed: true,
        pinLabel: 'Kaupmehe 7',
        destination: { lat: 59.5, lng: 24.8, label: 'Home', distanceM: 8100 }
      })
    });
    expect(screen.getByText(/^Tom: Kaupmehe 7/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('8.1 km to Home');
  });

  it('waits for a first position', () => {
    open({ share: share({ position: null }) });
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the first position');
  });

  it('warns when the position has stopped coming', () => {
    open({ share: share({ position: { ...share().position!, at: new Date(Date.now() - 4 * 60_000).toISOString() } }) });
    expect(screen.getByText(/Not updated for 4 min\. Tom's screen may be off\./)).toBeInTheDocument();
  });

  it('asks to be told at the chosen distance from where the waiter is', async () => {
    const onShareChange = vi.fn();
    const answer = share({
      watchers: [{ userId: 'u-irja', name: 'Irja', radiusM: 1000, distanceM: 3200, notified: false }]
    });
    api.watchLive.mockResolvedValue(answer);
    open({ onShareChange });

    await userEvent.click(screen.getByRole('button', { name: '1.0 km' }));

    expect(api.watchLive).toHaveBeenCalledWith('c1', 'u-tom', { lat: 59.43, lng: 24.75, radiusM: 1000 });
    expect(onShareChange).toHaveBeenCalledWith(answer);
  });

  it('does not restore a share from a pending watcher request after its viewer is removed', async () => {
    let finish!: (value: LiveShare) => void;
    api.watchLive.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const onShareChange = vi.fn();
    const { unmount } = open({ onShareChange });
    await userEvent.click(screen.getByRole('button', { name: '500 m' }));
    expect(api.watchLive).toHaveBeenCalled();
    unmount();
    await act(async () => finish(share()));
    expect(onShareChange).not.toHaveBeenCalled();
  });

  it('says why it could not, when the waiter’s location is blocked', async () => {
    where.currentPosition.mockRejectedValue(new Error('Location is blocked.'));
    open();

    await userEvent.click(screen.getByRole('button', { name: '500 m' }));

    expect(await screen.findByText('Location is blocked.')).toBeInTheDocument();
  });

  it('says so when the server will not', async () => {
    api.watchLive.mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
    open();

    await userEvent.click(screen.getByRole('button', { name: '500 m' }));

    expect(await screen.findByText('Could not set that up. Try again.')).toBeInTheDocument();
  });

  it('shows the distance while waiting, and can stop waiting', async () => {
    const onShareChange = vi.fn();
    api.unwatchLive.mockResolvedValue(share());
    open({
      onShareChange,
      share: share({ watchers: [{ userId: 'u-irja', name: 'Irja', radiusM: 1000, distanceM: 3200, notified: false }] })
    });

    expect(screen.getByText('Tom · 3.2 km away')).toBeInTheDocument();
    expect(screen.getByText('You get a notification when Tom is 1.0 km away')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.unwatchLive).toHaveBeenCalledWith('c1', 'u-tom');
    expect(onShareChange).toHaveBeenCalled();
  });

  it('says when they are close, and says so if stopping fails', async () => {
    api.unwatchLive.mockRejectedValue(new Error('offline'));
    open({
      share: share({ watchers: [{ userId: 'u-irja', name: 'Irja', radiusM: 1000, distanceM: 400, notified: true }] })
    });

    expect(screen.getByText('Tom is close')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Could not change that. Try again.')).toBeInTheDocument();
  });

  it('names a pin sent without a name by its address, and gives directions to it', () => {
    open({ share: share({ fixed: true, pinLabel: null }) });

    expect(screen.getByText(/^Tom: Kaupmehe 7, Tallinn/)).toBeInTheDocument();
    const directions = screen.getByRole('link', { name: 'Get directions' });
    expect(directions).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=59.4,24.7');
    expect(directions).toHaveAttribute('target', '_blank');
  });

  it('offers no directions to someone still driving', () => {
    open();
    expect(screen.queryByRole('link', { name: 'Get directions' })).not.toBeInTheDocument();
  });
});
