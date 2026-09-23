/**
 * A message's text split into plain runs and links.
 *
 * Only `http://`, `https://` and `www.` start a link. Bare domains ("see
 * example.com") are left as text: guessing them turns file names, version
 * numbers and sentences without a space after the full stop into links.
 */
export type TextPart = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

/**
 * Punctuation a sentence puts after a link rather than a link ends with.
 * A closing bracket stays when the link opened one, as Wikipedia's do.
 */
function trimTrailing(url: string): string {
  let end = url.length;
  while (end > 0) {
    const last = url[end - 1]!;
    if ('.,;:!?\'"'.includes(last)) {
      end--;
    } else if (last === ')') {
      const body = url.slice(0, end);
      const opens = (body.match(/\(/g) ?? []).length;
      const closes = (body.match(/\)/g) ?? []).length;
      if (closes > opens) end--;
      else break;
    } else {
      break;
    }
  }
  return url.slice(0, end);
}

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimTrailing(match[0]);
    // A host, at least: not "www." on its own or a scheme with nothing after it.
    if (!/^(?:https?:\/\/[^/?#]+|www\.[^./]+\.[^./])/i.test(url)) continue;
    const start = match.index!;
    if (start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, start) });
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push({ kind: 'link', text: url, href });
    cursor = start + url.length;
  }

  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}
