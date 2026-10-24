/** The first year the journal can hold entries for; the year pickers start here. */
export const FIRST_JOURNAL_YEAR = 2024;

/** Every year from the first through the current one, oldest first. */
export const journalYears = (now: Date = new Date()): number[] =>
  Array.from({ length: now.getFullYear() - FIRST_JOURNAL_YEAR + 1 }, (_, i) => FIRST_JOURNAL_YEAR + i);
