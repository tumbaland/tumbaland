import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveBanner } from './LiveBanner';
import type { LiveShare } from '../../types';

const share = (overrides: Partial<LiveShare> = {}): LiveShare => ({
  userId: 'u-irja',
  name: 'Irja',
  position: { lat: 59.4, lng: 24.7, accuracy: 8, heading: null, speed: null, at: new Date().toISOString() },
  startedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  destination: null,
  fixed: false,
  pinLabel: null,
  watchers: [],
  ...overrides
});

const renderBanner = (shares: LiveShare[], props: Partial<Parameters<typeof LiveBanner>[0]> = {}) =>
  render(
    <LiveBanner
      shares={shares}
      currentUserId="u-tom"
      sending={false}
      onOpenOwn={() => {}}
      onStopOwn={() => {}}
      onOpenOther={() => {}}
      {...props}
    />
  );

describe('LiveBanner', () => {
  it('shows nobody when nobody is sharing, or the share has run out', () => {
    const { container } = renderBanner([share({ endsAt: new Date(Date.now() - 1000).toISOString() })]);
    expect(container).toBeEmptyDOMElement();
  });

  it('says who is sharing, how far, and how fresh, and opens the map', async () => {
    const onOpenOther = vi.fn();
    renderBanner(
      [share({ watchers: [{ userId: 'u-tom', name: 'Tom', radiusM: 1000, distanceM: 3200, notified: false }] })],
      {
        onOpenOther
      }
    );

    expect(screen.getByText('Irja is sharing live · 3.2 km away · just now')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onOpenOther).toHaveBeenCalledWith('u-irja');
  });

  it('says how far is left to the destination when the reader has not said where they are', () => {
    renderBanner([share({ destination: { lat: 59.5, lng: 24.8, label: null, distanceM: 8100 } })]);
    expect(screen.getByText('Irja is sharing live · 8.1 km to go · just now')).toBeInTheDocument();
  });

  it('names the pin and the destination when the sharer did', () => {
    const { rerender } = renderBanner([share({ fixed: true, pinLabel: 'Kaupmehe 7' })]);
    expect(screen.getByText('Irja shared a pin: Kaupmehe 7 · just now')).toBeInTheDocument();

    rerender(
      <LiveBanner
        shares={[share({ destination: { lat: 59.5, lng: 24.8, label: 'Home', distanceM: 8100 } })]}
        currentUserId="u-tom"
        sending={false}
        onOpenOwn={() => {}}
        onStopOwn={() => {}}
        onOpenOther={() => {}}
      />
    );
    expect(screen.getByText('Irja is sharing live · 8.1 km to Home · just now')).toBeInTheDocument();
  });

  it('calls a pin a pin, for the one waiting and the one who sent it', () => {
    const { rerender } = renderBanner([share({ fixed: true })]);
    expect(screen.getByText('Irja shared a pin · just now')).toBeInTheDocument();

    rerender(
      <LiveBanner
        shares={[share({ userId: 'u-tom', name: 'Tom', fixed: true })]}
        currentUserId="u-tom"
        sending={false}
        onOpenOwn={() => {}}
        onStopOwn={() => {}}
        onOpenOther={() => {}}
      />
    );
    expect(screen.getByText('You shared a pin of where you are')).toBeInTheDocument();
  });

  it('says how old a position that has stopped coming is', () => {
    renderBanner([share({ position: { ...share().position!, at: new Date(Date.now() - 5 * 60_000).toISOString() } })]);
    expect(screen.getByText('Irja is sharing live · 5 min ago')).toBeInTheDocument();
  });

  it('lets the one sharing open or stop it, and says when this phone is not sending', async () => {
    const onOpenOwn = vi.fn();
    const onStopOwn = vi.fn();
    const { rerender } = renderBanner([share({ userId: 'u-tom', name: 'Tom' })], { onOpenOwn, onStopOwn });

    expect(screen.getByText('You are sharing, but this phone is not sending')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onOpenOwn).toHaveBeenCalled();
    expect(onStopOwn).toHaveBeenCalled();

    rerender(
      <LiveBanner
        shares={[share({ userId: 'u-tom', name: 'Tom' })]}
        currentUserId="u-tom"
        sending
        onOpenOwn={onOpenOwn}
        onStopOwn={onStopOwn}
        onOpenOther={() => {}}
      />
    );
    expect(screen.getByText('You are sharing where you are')).toBeInTheDocument();
  });
});
