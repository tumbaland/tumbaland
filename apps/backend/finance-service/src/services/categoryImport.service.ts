import Transaction from '../models/Transaction';
import { BadRequestError, ForbiddenError } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import { parseCsv } from './bankStatement.service';
import { applyCategoryChanges, CategoryChange } from './categoryRule.service';
import type { ImportOptions } from './importTypes';

// Categorising round trip: an export from this app, edited, and read back.

export interface CategoryImportResult {
  format: 'tumbaland';
  kind: 'categories';
  /** Rows whose category actually changed. */
  updated: number;
  /** Rows already in the category the file gives — nothing to do. */
  unchanged: number;
  /** Ids the file names that this owner does not have. */
  notFound: number;
  /** Rows with no id or no category to apply. */
  malformed: number;
  categories: Array<{ category: string; count: number }>;
}

/** True when the text is one of this app's own exports. */
export function isCategoryFile(text: string): boolean {
  const [header] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) return false;
  const columns = header.map((h) => h.trim().toLowerCase());
  return columns.includes('id') && columns.includes('category');
}

/**
 * Apply categories from an edited export.
 *
 * Only the category is read: the file has been round-tripped through a
 * spreadsheet, where dates and amounts get reformatted by the locale and would
 * come back subtly different from what the bank actually said.
 */
export const importCategories = async (
  csv: string,
  options: ImportOptions
): Promise<CategoryImportResult> => {
  if (options.groupId && !(options.userGroups || []).includes(options.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const [header, ...body] = parseCsv(csv.replace(/^\uFEFF/, ''));
  const columns = header.map((h) => h.trim().toLowerCase());
  const idAt = columns.indexOf('id');
  const categoryAt = columns.indexOf('category');

  if (idAt === -1 || categoryAt === -1) {
    throw new BadRequestError('The file needs an "id" and a "category" column');
  }

  const wanted = new Map<string, string>();
  let malformed = 0;

  for (const cells of body) {
    const id = (cells[idAt] || '').trim();
    const category = (cells[categoryAt] || '').trim();
    // A 24-character hex id is what an export writes; anything else has been
    // mangled or invented, and looking it up would throw rather than skip.
    if (!/^[a-f\d]{24}$/i.test(id) || !category) {
      malformed++;
      continue;
    }
    wanted.set(id, category);
  }

  if (wanted.size === 0) {
    return { format: 'tumbaland', kind: 'categories', updated: 0, unchanged: 0, notFound: 0, malformed, categories: [] };
  }

  const scope = tenantScope(options.userId, options.groupId ? [options.groupId] : []);
  const existing = await Transaction.find(
    { ...scope, _id: { $in: [...wanted.keys()] } },
    { category: 1 }
  ).lean();

  const held = new Map(existing.map((t) => [String(t._id), t.category]));
  const changes: CategoryChange[] = [];
  let unchanged = 0;

  for (const [id, category] of wanted) {
    const current = held.get(id);
    if (current === undefined) continue;
    if (current === category) { unchanged++; continue; }
    changes.push({ id, category });
  }

  const categories = await applyCategoryChanges(changes);

  return {
    format: 'tumbaland',
    kind: 'categories',
    updated: changes.length,
    unchanged,
    notFound: wanted.size - held.size,
    malformed,
    categories
  };
};
