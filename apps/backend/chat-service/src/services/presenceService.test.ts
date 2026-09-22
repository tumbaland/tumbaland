const published: Array<{ groupId: string; event: { type: string; payload: unknown }; except?: string }> = [];
let streaming = new Set<string>();

jest.mock('./streamHub', () => ({
  isOnline: (userId: string) => streaming.has(userId),
  publishToGroup: (groupId: string, event: { type: string; payload: unknown }, except?: string) =>
    published.push({ groupId, event, except })
}));

const stored = new Map<string, { userId: string; lastActiveAt?: Date | null }>();
jest.mock('../models/Presence', () => ({
  Presence: {
    findOne: jest.fn(async ({ userId }: { userId: string }) => stored.get(userId) ?? null),
    find: jest.fn(async () => [...stored.values()]),
    updateOne: jest.fn(async () => undefined)
  }
}));

import { ACTIVE_WINDOW_MS, clearPresence, presenceFor, sweep, touch } from './presenceService';

const TOM = { id: 'u-tom', email: 't@x', name: 'Tom', groups: ['g1'] };

beforeEach(() => {
  published.length = 0;
  streaming = new Set();
  stored.clear();
  clearPresence();
  jest.useFakeTimers({ now: new Date('2026-09-22T12:00:00Z') });
});

afterEach(() => jest.useRealTimers());

const presenceEvents = () => published.filter((entry) => entry.event.type === 'presence');

it('announces coming online once, to the group, and not to the person themselves', async () => {
  await touch(TOM);
  await touch(TOM);

  expect(presenceEvents()).toHaveLength(1);
  expect(presenceEvents()[0]).toMatchObject({ groupId: 'g1', except: 'u-tom', event: { payload: { online: true } } });
});

it('announces going offline once the window has passed with no sign of life', async () => {
  await touch(TOM);

  jest.advanceTimersByTime(ACTIVE_WINDOW_MS - 1000);
  sweep();
  expect(presenceEvents()).toHaveLength(1);

  jest.advanceTimersByTime(2000);
  sweep();
  expect(presenceEvents()).toHaveLength(2);
  expect(presenceEvents()[1]!.event.payload).toMatchObject({ online: false, lastActiveAt: '2026-09-22T12:00:00.000Z' });
});

it('stays online for as long as a stream is open, however quiet', async () => {
  streaming.add('u-tom');
  await touch(TOM);

  jest.advanceTimersByTime(ACTIVE_WINDOW_MS * 5);
  sweep();

  expect(presenceEvents()).toHaveLength(1);
  expect((await presenceFor(['u-tom']))[0]).toMatchObject({ online: true });
});

it('falls back to the stored time for someone not seen since a restart', async () => {
  stored.set('u-tom', { userId: 'u-tom', lastActiveAt: new Date('2026-09-22T09:00:00Z') });

  expect(await presenceFor(['u-tom'])).toEqual([
    { userId: 'u-tom', online: false, lastActiveAt: '2026-09-22T09:00:00.000Z' }
  ]);
});
