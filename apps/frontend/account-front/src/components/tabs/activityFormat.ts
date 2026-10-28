import type { ToolCall } from '../../services/auditService';

/**
 * What a tool call cost, in the two units that decide anything.
 *
 * Tokens first, because that is the one that surprises people. A tool result is
 * not a page you close: it stays in the conversation and is sent again with
 * every message after it, so ten thousand tokens is ten thousand paid for on
 * every turn that follows, not once.
 */
export const toolCost = (tool: ToolCall): string =>
  `~${tool.tokens.toLocaleString()} tokens · ${tool.ms.toLocaleString()} ms`;

/** Singular, and without the underscores the API stores them with. */
export const resourceName = (resource: string): string =>
  resource.replace(/_/g, ' ').replace(/ies$/, 'y').replace(/s$/, '');

/** "an activity", "a photo" — a row that reads as a sentence or not at all. */
export const withArticle = (noun: string): string =>
  `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

/**
 * A stored value, as a person would read it.
 *
 * Absence is spelled out rather than left blank: a change from nothing to
 * something and a change nobody can see are different, and an empty cell reads
 * as the second.
 */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'nothing';
  if (typeof value === 'string') {
    const asDate = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
    return asDate && !isNaN(asDate.getTime())
      ? asDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : `“${value}”`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** The fields worth showing from a stored document, in the order they read best. */
const SUMMARY_FIELDS = ['description', 'hours', 'date', 'name'];

export function summarize(snapshot: Record<string, unknown>): string {
  const parts = SUMMARY_FIELDS.filter((field) => snapshot[field] !== undefined && snapshot[field] !== '')
    .map((field) => (field === 'hours' ? `${snapshot[field]}h` : displayValue(snapshot[field])));
  return parts.join(' · ');
}

export const dayHeading = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

export const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
