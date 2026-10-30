/**
 * Which bots a message talks to.
 *
 * `@Tumbi` is a mention; `@Tumbi's` is too, and `@Tumbiii` is not. Names can
 * contain spaces and one name can begin another ("Mia" and "Mia Bot"), so the
 * longest names are matched first and the text they matched is blanked before
 * the shorter ones look, which stops "@Mia Bot" from also waking Mia.
 *
 * `@Claude` is not a bot: it is an alias for the asker's own bot, resolved by
 * the caller, which is why it comes back as a marker and not as a match.
 */

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LETTER_OR_DIGIT = '[\\p{L}\\p{N}]';

export interface Mentioned<T> {
  bot: T;
  /** Where in the message the mention starts, for putting answers in the order they were asked. */
  at: number;
}

export function findMentions<T extends { name: string }>(body: string, bots: T[]): { bots: Mentioned<T>[]; claude: boolean } {
  let rest = body;
  const found: Mentioned<T>[] = [];
  const blank = (start: number, length: number) => {
    rest = rest.slice(0, start) + ' '.repeat(length) + rest.slice(start + length);
  };

  for (const bot of [...bots].sort((a, b) => b.name.length - a.name.length)) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])@(${escape(bot.name)})(?!${LETTER_OR_DIGIT})`, 'iu');
    const match = pattern.exec(rest);
    if (!match) continue;
    const at = match.index + match[1]!.length;
    found.push({ bot, at });
    blank(at, 1 + match[2]!.length);
  }

  const claude = new RegExp(`(^|[^\\p{L}\\p{N}])@claude(?!${LETTER_OR_DIGIT})`, 'iu').test(rest);
  return { bots: found.sort((a, b) => a.at - b.at), claude };
}
