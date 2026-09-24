import { Response } from 'express';
import { closeAllSseStreams, openSseStream } from '@tumbaland/backend-core';
import {
  MAX_STREAMS_PER_USER,
  clearSubscribers,
  formatEvent,
  isOnline,
  onlineInGroup,
  openStreamCount,
  publishToGroup,
  subscribe
} from './streamHub';

/** Just enough of a Response for a real stream to write to. */
function fakeRes() {
  return {
    written: [] as string[],
    writeHead() {},
    write(chunk: string) {
      this.written.push(chunk);
      return true;
    },
    end() {},
    on() {}
  };
}

const asStream = (res: ReturnType<typeof fakeRes>) => openSseStream(res as unknown as Response);

afterEach(() => {
  closeAllSseStreams();
  clearSubscribers();
});

describe('formatEvent', () => {
  it('emits id, event and data lines terminated by a blank line', () => {
    const frame = formatEvent({ type: 'typing', conversationId: 'c1', at: 1700, payload: { userId: 'u1' } });

    expect(frame).toMatch(/^id: 1700\n/);
    expect(frame).toContain('event: typing\n');
    expect(frame.endsWith('\n\n')).toBe(true);

    const data = JSON.parse(frame.split('data: ')[1]!.trim());
    expect(data).toEqual({ type: 'typing', conversationId: 'c1', at: 1700, payload: { userId: 'u1' } });
  });
});

describe('subscribe', () => {
  it('registers a subscriber and reports them online', () => {
    const unsubscribe = subscribe('u1', ['g1'], asStream(fakeRes()));

    expect(unsubscribe).toBeTruthy();
    expect(isOnline('u1')).toBe(true);
    expect(openStreamCount()).toBe(1);
  });

  it('forgets the user entirely once their last stream closes', () => {
    const unsubscribe = subscribe('u1', ['g1'], asStream(fakeRes()))!;
    unsubscribe();

    expect(isOnline('u1')).toBe(false);
    expect(openStreamCount()).toBe(0);
  });

  it('refuses past the per-user cap rather than letting one client exhaust the pool', () => {
    for (let i = 0; i < MAX_STREAMS_PER_USER; i++) {
      expect(subscribe('u1', ['g1'], asStream(fakeRes()))).toBeTruthy();
    }

    expect(subscribe('u1', ['g1'], asStream(fakeRes()))).toBeNull();
    expect(openStreamCount()).toBe(MAX_STREAMS_PER_USER);
  });

  it('caps per user, not globally', () => {
    for (let i = 0; i < MAX_STREAMS_PER_USER; i++) subscribe('u1', ['g1'], asStream(fakeRes()));

    expect(subscribe('u2', ['g1'], asStream(fakeRes()))).toBeTruthy();
  });
});

describe('publishToGroup', () => {
  const event = { type: 'message.created', conversationId: 'c1', at: 1, payload: { id: 'm1' } } as const;

  it('delivers to every stream the recipient holds', () => {
    const phone = fakeRes();
    const laptop = fakeRes();
    subscribe('u1', ['g1'], asStream(phone));
    subscribe('u1', ['g1'], asStream(laptop));

    publishToGroup('g1', { ...event });

    expect(phone.written).toHaveLength(1);
    expect(laptop.written).toHaveLength(1);
  });

  it('delivers to everyone in the group', () => {
    const tom = fakeRes();
    const irja = fakeRes();
    subscribe('u-tom', ['g1'], asStream(tom));
    subscribe('u-irja', ['g1'], asStream(irja));

    publishToGroup('g1', { ...event });

    expect(tom.written).toHaveLength(1);
    expect(irja.written).toHaveLength(1);
  });

  it('does not deliver to a stream authenticated for a different group', () => {
    const outsider = fakeRes();
    subscribe('u-persik', ['g9'], asStream(outsider));

    publishToGroup('g1', { ...event });

    expect(outsider.written).toHaveLength(0);
  });

  it('delivers to a subscriber who is in several groups including this one', () => {
    const res = fakeRes();
    subscribe('u1', ['g9', 'g1'], asStream(res));

    publishToGroup('g1', { ...event });

    expect(res.written).toHaveLength(1);
  });

  it('skips the excluded user, so nobody gets their own typing indicator back', () => {
    const sender = fakeRes();
    const other = fakeRes();
    subscribe('u-tom', ['g1'], asStream(sender));
    subscribe('u-irja', ['g1'], asStream(other));

    publishToGroup('g1', { type: 'typing', conversationId: 'c1', at: 1, payload: {} }, 'u-tom');

    expect(sender.written).toHaveLength(0);
    expect(other.written).toHaveLength(1);
  });

  it('drops a subscriber whose socket throws, and still serves the others', () => {
    const dead = fakeRes();
    dead.write = () => {
      throw new Error('EPIPE');
    };
    const alive = fakeRes();
    subscribe('u1', ['g1'], asStream(dead));
    subscribe('u1', ['g1'], asStream(alive));

    publishToGroup('g1', { ...event });

    expect(alive.written).toHaveLength(1);
    expect(openStreamCount()).toBe(1);
  });

  it('is a no-op when nobody in the group is connected', () => {
    expect(() => publishToGroup('g1', { ...event })).not.toThrow();
  });
});

describe('onlineInGroup', () => {
  it('lists the connected members of one group and nobody else', () => {
    subscribe('u-tom', ['g1'], asStream(fakeRes()));
    subscribe('u-irja', ['g1'], asStream(fakeRes()));
    subscribe('u-persik', ['g9'], asStream(fakeRes()));

    expect(onlineInGroup('g1')).toEqual(new Set(['u-tom', 'u-irja']));
  });

  it('counts someone once however many devices they have open', () => {
    subscribe('u-tom', ['g1'], asStream(fakeRes()));
    subscribe('u-tom', ['g1'], asStream(fakeRes()));

    expect(onlineInGroup('g1')).toEqual(new Set(['u-tom']));
  });

  it('is empty when nobody is connected', () => {
    expect(onlineInGroup('g1').size).toBe(0);
  });
});
