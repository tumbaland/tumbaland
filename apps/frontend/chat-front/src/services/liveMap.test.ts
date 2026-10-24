import { describe, expect, it } from 'vite-plus/test';
import { OTHER_COLOR, apartBetween, buildLivePoints, isStale } from './liveMap';
import { DESTINATION_COLOR, PERSON_COLOR } from './live';
import type { ConversationMember, LiveShare } from '../types';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const share = (overrides: Partial<LiveShare> = {}): LiveShare => ({
  userId: 'u-irja',
  name: 'Irja',
  position: { lat: 59.41, lng: 24.7, accuracy: 10, heading: null, speed: null, at: ago(5_000) },
  destination: null,
  fixed: false,
  pinLabel: null,
  startedAt: ago(60_000),
  endsAt: new Date(NOW + 3_600_000).toISOString(),
  watchers: [],
  ...overrides
});

const members: ConversationMember[] = [
  { userId: 'u-tom', email: 'tom@example.com', name: 'Tom', picture: 'https://example.com/tom.jpg', joinedAt: '' },
  { userId: 'u-irja', email: 'irja@example.com', name: 'Irja', picture: null, joinedAt: '' }
];
const options = { members, currentUserId: 'u-tom', now: NOW };

describe('buildLivePoints', () => {
  it('draws everyone sharing, each in their own colour, with their photo or initial', () => {
    const points = buildLivePoints([share({ userId: 'u-tom', name: 'Tom' }), share()], options);

    expect(points).toEqual([
      expect.objectContaining({
        id: 'me',
        label: 'You',
        color: PERSON_COLOR,
        picture: 'https://example.com/tom.jpg',
        initial: 'T',
        kind: 'person',
        stale: false
      }),
      expect.objectContaining({
        id: 'u-irja',
        label: 'Irja',
        color: OTHER_COLOR,
        picture: null,
        initial: 'I',
        kind: 'person'
      })
    ]);
  });

  it('puts this phone on the map before the server has its first position', () => {
    const points = buildLivePoints([], { ...options, ownPosition: { lat: 59.4, lng: 24.7, accuracy: 12 } });

    expect(points).toEqual([
      expect.objectContaining({ id: 'me', lat: 59.4, picture: 'https://example.com/tom.jpg', initial: 'T' })
    ]);
  });

  it('prefers where this phone says it is over the server copy, and calls it stale by its own clock', () => {
    const own = share({ userId: 'u-tom', name: 'Tom' });
    const fresh = buildLivePoints([own], { ...options, ownPosition: { lat: 59.5, lng: 24.9, at: NOW - 1_000 } });
    expect(fresh[0]).toMatchObject({ lat: 59.5, lng: 24.9, stale: false });

    const old = buildLivePoints([own], { ...options, ownPosition: { lat: 59.5, lng: 24.9, at: NOW - 120_000 } });
    expect(old[0]).toMatchObject({ stale: true });
  });

  it('fades a position not heard from for a minute, saying how old, but never a pin', () => {
    const [person, pin] = buildLivePoints(
      [
        share({ position: { ...share().position!, at: ago(90_000) } }),
        share({ userId: 'u-x', name: 'X', fixed: true, position: { ...share().position!, at: ago(3_600_000) } })
      ],
      options
    );
    expect(person).toMatchObject({ stale: true, label: 'Irja · 1 min ago' });
    expect(pin).toMatchObject({ stale: false, label: 'X' });
  });

  it('draws a pin as the face of who sent it, named by whose it is and what it is', () => {
    const pinned = share({ fixed: true, pinLabel: 'The store' });
    expect(buildLivePoints([pinned], options)[0]).toMatchObject({ kind: 'person', label: 'Irja: The store' });
    expect(buildLivePoints([share({ fixed: true })], { ...options, labels: { 'u-irja': 'Viru 4' } })[0]!.label).toBe(
      'Irja: Viru 4'
    );
    const own = share({ userId: 'u-tom', name: 'Tom', fixed: true, pinLabel: 'Home' });
    expect(buildLivePoints([own], options)[0]).toMatchObject({ id: 'me', label: 'You: Home', initial: 'T' });
  });

  it('draws destinations, the caller’s in green and the other’s in theirs', () => {
    const points = buildLivePoints(
      [
        share({ userId: 'u-tom', name: 'Tom', destination: { lat: 59.5, lng: 24.8, label: 'Home', distanceM: 1 } }),
        share({ destination: { lat: 59.6, lng: 24.9, label: null, distanceM: 1 } })
      ],
      options
    );

    expect(points.find((point) => point.id === 'destination')).toMatchObject({
      color: DESTINATION_COLOR,
      label: 'Home',
      kind: 'place'
    });
    expect(points.find((point) => point.id === 'destination:u-irja')).toMatchObject({
      color: OTHER_COLOR,
      label: 'Destination'
    });
  });

  it('leaves out shares that have run out, and the caller when asked', () => {
    const points = buildLivePoints([share({ endsAt: ago(1_000) }), share({ userId: 'u-tom', name: 'Tom' })], {
      ...options,
      othersOnly: true,
      ownPosition: { lat: 59.4, lng: 24.7 }
    });
    expect(points).toEqual([]);
  });

  it('skips a share with no position yet, and names one with no name', () => {
    expect(buildLivePoints([share({ position: null })], options)).toEqual([]);
    expect(buildLivePoints([share({ name: '' })], options)[0]!.label).toBe('Irja');
    expect(buildLivePoints([share({ name: '', userId: 'u-nobody' })], options)[0]).toMatchObject({
      label: 'Someone',
      initial: 'S'
    });
  });
});

describe('isStale', () => {
  it('is about live positions only', () => {
    expect(isStale(share(), NOW)).toBe(false);
    expect(isStale(share({ position: { ...share().position!, at: ago(61_000) } }), NOW)).toBe(true);
    expect(isStale(share({ fixed: true, position: { ...share().position!, at: ago(61_000) } }), NOW)).toBe(false);
    expect(isStale(share({ position: null }), NOW)).toBe(false);
  });
});

describe('apartBetween', () => {
  const me = { lat: 59.4, lng: 24.7 };

  it('tells the distance between two recent positions', () => {
    expect(Math.round(apartBetween(me, share(), NOW)!)).toBeGreaterThan(1000);
  });

  it('tells nothing when either side is unknown, old or over', () => {
    expect(apartBetween(null, share(), NOW)).toBeNull();
    expect(apartBetween(me, share({ position: null }), NOW)).toBeNull();
    expect(apartBetween(me, share({ position: { ...share().position!, at: ago(120_000) } }), NOW)).toBeNull();
    expect(apartBetween(me, share({ endsAt: ago(1) }), NOW)).toBeNull();
  });
});
