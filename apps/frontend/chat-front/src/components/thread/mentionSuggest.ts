/**
 * The `@` list in the message box.
 *
 * What is being typed after the last `@` decides who is offered: the assistants
 * whose name starts with it, ignoring case, and never a paused one, which would
 * only answer "paused". A name can hold spaces, but a space ends the thing being
 * typed here, so the list closes once someone writes past the first word.
 */
const TOKEN = /(^|\s)@([\p{L}\p{N}]*)$/u;

const MAX_SUGGESTIONS = 4;

export function mentionSuggestions<T extends { name: string; paused: boolean }>(text: string, bots: readonly T[]): T[] {
  const match = TOKEN.exec(text);
  if (!match) return [];
  const typed = match[2]!.toLowerCase();
  return bots.filter((bot) => !bot.paused && bot.name.toLowerCase().startsWith(typed)).slice(0, MAX_SUGGESTIONS);
}

/** Puts the chosen name where the `@...` was being typed, and a space after it, ready for the question. */
export function insertMention(text: string, name: string): string {
  return text.replace(TOKEN, (_whole, lead: string) => `${lead}@${name} `);
}
