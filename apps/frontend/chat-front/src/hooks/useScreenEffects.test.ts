import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScreenEffects } from './useScreenEffects';
import type { ThreadMessage } from '../types';

const ME = 'u-tom';
const HER = 'u-irja';
const now = () => new Date().toISOString();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

let counter = 0;
const message = (overrides: Partial<ThreadMessage> = {}): ThreadMessage => {
  counter += 1;
  return {
    id: `m${counter}`,
    conversationId: 'c1',
    senderId: HER,
    senderEmail: '',
    senderName: 'Irja',
    kind: 'text',
    body: 'hello',
    attachments: [],
    replyTo: null,
    reactions: [],
    clientId: `client-${counter}`,
    editedAt: null,
    deletedAt: null,
    createdAt: minutesAgo(30),
    ...overrides
  };
};

const setup = (initial: ThreadMessage[], ready = true) =>
  renderHook(({ messages, ready }) => useScreenEffects('c1', messages, ME, ready), {
    initialProps: { messages: initial, ready }
  });

beforeEach(() => window.localStorage.clear());

describe('useScreenEffects', () => {
  it('plays for a message that arrives while the thread is open', () => {
    const history = [message()];
    const { result, rerender } = setup(history);
    expect(result.current.playing).toBeNull();

    rerender({ messages: [...history, message({ body: '❤️', createdAt: now() })], ready: true });

    expect(result.current.playing?.effect).toBe('hearts');
  });

  it('plays for one just sent from here', () => {
    const history = [message()];
    const { result, rerender } = setup(history);

    rerender({
      messages: [...history, message({ senderId: ME, effect: 'confetti', delivery: 'pending', createdAt: now() })],
      ready: true
    });

    expect(result.current.playing?.effect).toBe('confetti');
  });

  it('does not replay the history it opened on', () => {
    const { result } = setup([message({ body: '❤️' }), message({ body: 'ok', senderId: ME })]);
    expect(result.current.playing).toBeNull();
  });

  it('plays the newest message on opening, when it came from the other person and has not been seen here', () => {
    const { result } = setup([message(), message({ body: '😘', createdAt: minutesAgo(5) })]);
    expect(result.current.playing?.effect).toBe('kisses');
  });

  it('plays that one only once on this device', () => {
    const history = [message(), message({ body: '😘', createdAt: minutesAgo(5) })];
    setup(history).unmount();

    const { result } = setup(history);

    expect(result.current.playing).toBeNull();
  });

  it('does not play your own message back at you on opening', () => {
    const { result } = setup([message({ body: '❤️', senderId: ME, createdAt: minutesAgo(1) })]);
    expect(result.current.playing).toBeNull();
  });

  it('leaves out an older page scrolled back to', () => {
    const latest = message({ createdAt: minutesAgo(1) });
    const { result, rerender } = setup([latest]);

    rerender({ messages: [message({ body: '🎉', createdAt: minutesAgo(600) }), latest], ready: true });

    expect(result.current.playing).toBeNull();
  });

  it('waits for the thread to load before taking what is there as history', () => {
    const { result, rerender } = setup([], false);
    const history = [message({ body: '🎉', senderId: ME })];

    rerender({ messages: history, ready: true });

    expect(result.current.playing).toBeNull();
  });

  it('clears once the effect has played', () => {
    const history = [message()];
    const { result, rerender } = setup(history);
    rerender({ messages: [...history, message({ body: '❤️', createdAt: now() })], ready: true });

    act(() => result.current.done());

    expect(result.current.playing).toBeNull();
  });
});
