export { initials } from '@tumbaland/frontend-core';

const TINTS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

/**
 * The same key always gets the same colour, so a group looks the same in the
 * list and on its own page.
 */
export const tintFor = (key: string): string => {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
};
