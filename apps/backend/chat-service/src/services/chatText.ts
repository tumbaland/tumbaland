import type { Source } from './assistantClaude';

/**
 * A bot's reply as chat text.
 *
 * Models write Markdown out of habit, whatever they are told, and a chat bubble
 * shows it as typed: `**Kolm Sõpra**`, `- item`, `## Tonight`. The bubble keeps
 * line breaks and turns addresses into links, so the reply is made plain here,
 * once, where push notifications and previews read it too: emphasis marks are
 * dropped, list items get a bullet, a link keeps its address for the bubble to
 * link.
 */
export function chatText(markdown: string): string {
  const lines: string[] = [];
  let fenced = false;
  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      lines.push(raw);
      continue;
    }
    // A rule is decoration.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) continue;
    let line = raw
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^(\s*)[-*+]\s+(\[[ xX]\]\s+)?/, '$1• ')
      .replace(/^\s*>\s?/, '');
    line = inline(line);
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inline(text: string): string {
  return (
    text
      // [words](https://...) as "words (https://...)", or just the address when they are the same.
      .replace(/!?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) => (label.trim() === url ? url : `${label} (${url})`))
      .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      // Bold and italic, by * and by _ (the latter only around whole words, so snake_case survives).
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1$2')
      .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1$2')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
  );
}

/** At most this many pages are listed under a reply: enough to check it, not a bibliography. */
const MAX_SOURCES = 3;

/** The reply, then the pages it drew on, one to a line, unless the reply already gives each address. */
export function withSources(text: string, sources: Source[]): string {
  const missing = sources.filter((source) => !text.includes(source.url)).slice(0, MAX_SOURCES);
  if (missing.length === 0) return text;
  return `${text}\n\nSources:\n${missing.map((source) => `• ${source.title === source.url ? source.url : `${source.title}: ${source.url}`}`).join('\n')}`;
}
