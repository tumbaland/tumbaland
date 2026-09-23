import { describe, expect, it } from 'vitest';
import { effectOf } from './effects';

const message = (body: string, overrides: Partial<Parameters<typeof effectOf>[0]> = {}) => ({
  body,
  effect: null,
  deletedAt: null,
  kind: 'text' as const,
  ...overrides
});

describe('effectOf', () => {
  it.each([['❤️'], ['❤'], ['💕💖'], ['🥰'], ['❤️‍🔥'], ['❤️ ❤️ ❤️']])('fills the screen with hearts for %s', (body) => {
    expect(effectOf(message(body))).toBe('hearts');
  });

  it.each([['🎉'], ['🥳🎊']])('throws confetti for %s', (body) => {
    expect(effectOf(message(body))).toBe('confetti');
  });

  it.each([['😘'], ['💋💋']])('sends kisses for %s', (body) => {
    expect(effectOf(message(body))).toBe('kisses');
  });

  it.each([['❤️ you'], ['hello'], ['❤️🎉'], ['❤️❤️❤️❤️'], ['👍'], ['']])('plays nothing for %s', (body) => {
    expect(effectOf(message(body))).toBeNull();
  });

  it('plays the effect a message was sent with, whatever it says', () => {
    expect(effectOf(message('happy birthday', { effect: 'confetti' }))).toBe('confetti');
  });

  it('plays nothing for an unsent message', () => {
    expect(effectOf(message('❤️', { effect: 'hearts', deletedAt: '2026-09-24T10:00:00.000Z' }))).toBeNull();
  });
});
