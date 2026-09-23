/**
 * Makes typed search text match literally inside a Mongo `$regex`.
 *
 * Unescaped, a search for "c++" or ":)" is an invalid pattern and the request
 * fails with a 500, and a crafted one can keep the database busy backtracking.
 */
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
