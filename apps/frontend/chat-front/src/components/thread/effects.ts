import type { Message, MessageEffect } from '../../types';

/** In the order the send button's menu offers them. */
export const EFFECTS: { id: MessageEffect; label: string; emoji: string }[] = [
  { id: 'hearts', label: 'Send with hearts', emoji: '❤️' },
  { id: 'confetti', label: 'Send with confetti', emoji: '🎉' },
  { id: 'kisses', label: 'Send with kisses', emoji: '💋' }
];

/** What floats around a bubble sent with each effect. */
export const BUBBLE_GLYPHS: Record<MessageEffect, string[]> = {
  hearts: ['❤️', '💕', '💖', '❤️', '💗', '💞'],
  confetti: ['🎉', '✨', '🎊', '✨', '🎈', '✨'],
  kisses: ['💋', '😘', '💋', '💕', '💋', '😚']
};

// Kept without the variation selector (U+FE0F), which the same heart arrives
// with or without depending on the keyboard it was typed on.
const TRIGGERS: Record<MessageEffect, Set<string>> = {
  hearts: new Set([
    '❤', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '🩷', '🩵', '🩶',
    '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣', '🥰', '😍', '❤‍🔥'
  ]),
  confetti: new Set(['🎉', '🎊', '🥳', '🍾', '🎈', '🎂']),
  kisses: new Set(['😘', '💋', '😚', '😙', '😗', '💏'])
};

/** How many emoji a message can be and still set the screen off. Matches the jumbo size. */
const TRIGGER_LIMIT = 3;

const graphemes = (text: string): string[] =>
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((part) => part.segment)
    : [...text];

/**
 * The effect a message plays across the screen when it arrives.
 *
 * Either the one it was sent with, or the one a short all-emoji message asks
 * for by itself: "❤️" on its own fills the screen with hearts, and "❤️ you"
 * does not, because a line of text with a heart in it is just a message.
 */
export function effectOf(message: Pick<Message, 'body' | 'effect' | 'deletedAt' | 'kind'>): MessageEffect | null {
  if (message.deletedAt || message.kind === 'system') return null;
  if (message.effect) return message.effect;

  const glyphs = graphemes(message.body.replace(/\s/g, '')).map((glyph) => glyph.replace(/️/g, ''));
  if (glyphs.length === 0 || glyphs.length > TRIGGER_LIMIT) return null;

  for (const [effect, triggers] of Object.entries(TRIGGERS) as [MessageEffect, Set<string>][]) {
    if (glyphs.every((glyph) => triggers.has(glyph))) return effect;
  }
  return null;
}
