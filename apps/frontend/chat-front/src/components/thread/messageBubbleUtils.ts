import type { Attachment, ThreadMessage } from '../../types';
import { isVisualType } from '../../services/voice';

/**
 * How many code points still count as "just emoji".
 *
 * A message that is only emoji is drawn large and without a bubble. It is a
 * small thing and it is most of what makes a chat feel like a chat rather than
 * a comment thread.
 */
const JUMBO_LIMIT = 3;

/** Whether the body is nothing but emoji, in a small enough quantity. */
export function isJumbo(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;

  const points = [...trimmed];
  if (points.length > JUMBO_LIMIT * 4) return false;

  // Extended_Pictographic covers emoji proper; the rest of the class allows the
  // joiners, skin-tone modifiers and variation selectors a single emoji is
  // built from, so a thumbs-up with a tone is one emoji rather than three.
  const emojiOnly = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u;
  if (!emojiOnly.test(trimmed)) return false;

  const glyphs = [...trimmed.replace(/\s/g, '')].filter((point) =>
    /\p{Extended_Pictographic}/u.test(point)
  ).length;
  return glyphs > 0 && glyphs <= JUMBO_LIMIT;
}

/** Whether the sender may still edit or unsend this message. */
export function canChange(message: ThreadMessage, mine: boolean): boolean {
  const stored = message.delivery !== 'pending' && message.delivery !== 'failed';
  return mine && stored && !message.deletedAt && message.kind !== 'system';
}

/**
 * The line under a message's photos: "In Rome", or, when they went different
 * ways, "2 of 3 in Rome" or "In 2 albums".
 */
export function albumLabel(attachments: Attachment[]): string {
  const photos = attachments.filter((attachment) => isVisualType(attachment.mimetype));
  const saved = photos.filter((attachment) => attachment.albumId);
  const albums = new Set(saved.map((attachment) => attachment.albumId));
  const name = saved[0]?.albumName ?? 'album';
  if (albums.size > 1) return `In ${albums.size} albums`;
  if (saved.length < photos.length) return `${saved.length} of ${photos.length} in ${name}`;
  return `In ${name}`;
}
