import Transaction from '../models/Transaction';
import { BadRequestError, ForbiddenError } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import {
  readStatement,
  isAccountStatement,
  findOwnAccounts,
  classifyRow,
  parseCsv,
  RowKind
} from './bankStatement.service';

/**
 * The two shapes this app reads.
 *
 *   seb        — a bank account statement, the source of the transactions
 *   tumbaland  — an export from this app with the categories edited
 *
 * Named rather than left implicit so a caller can state what it is handing over
 * and be told when the file disagrees, instead of a mis-sniffed statement being
 * quietly read as a category list.
 */
export type TransactionFileFormat = 'seb' | 'tumbaland';

export const FORMAT_LABELS: Record<TransactionFileFormat, string> = {
  seb: 'SEB account statement',
  tumbaland: 'Tumbaland export'
};

export interface ImportResult {
  format: 'seb';
  /** Rows that became new transactions. */
  imported: number;
  /**
   * Rows already present from an earlier import of an overlapping period.
   * Re-importing the same month is expected — the bank's archive reference is
   * stable, so the overlap is recognised rather than duplicated.
   */
  duplicates: number;
  /** Rows deliberately left out, by reason. */
  skipped: Record<string, number>;
  /** What the file covered, so the caller can see whether it was the right one. */
  period: { from: string; to: string } | null;
  rows: number;
  /** Categories the new rows landed in, largest first. */
  categories: Array<{ category: string; count: number; amount: number }>;
}

const SKIP_REASONS: Record<'transfer' | 'dividend', string> = {
  transfer: 'Transfer between your own accounts',
  dividend: 'Dividend (belongs in the trade log)'
};

/**
 * Rows that become transactions. Securities settlements and pension
 * contributions are included because the money genuinely left the account —
 * excluding them made the invested figure report a fraction of the truth — and
 * they carry a capital category, so they never read as spending.
 */
const IMPORTED_KINDS: RowKind[] = ['cashflow', 'security', 'pension'];

export interface ImportOptions {
  userId: string;
  groupId?: string;
  userGroups?: string[];
}

/**
 * Turn a SEB CSV statement into transactions, skipping anything already held.
 *
 * Duplicate detection is by the bank's own archive reference rather than by
 * comparing dates and amounts: two coffees on the same day for the same price
 * are two real transactions, and only the reference can tell them apart from
 * one row imported twice.
 */
export const importStatement = async (
  csv: string,
  options: ImportOptions
): Promise<ImportResult> => {
  if (!csv || !csv.trim()) {
    throw new BadRequestError('The uploaded file is empty');
  }
  if (!isAccountStatement(csv)) {
    throw new BadRequestError(
      'This does not look like a SEB account statement — expected a "Kliendi konto" column'
    );
  }
  if (options.groupId && !(options.userGroups || []).includes(options.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const rows = readStatement(csv);
  if (rows.length === 0) {
    throw new BadRequestError('No data rows found in the file');
  }

  const ownAccounts = findOwnAccounts(rows);
  const skipped: Record<string, number> = {};
  const note = (reason: string) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  const candidates = [];
  for (const row of rows) {
    const classified = classifyRow(row, ownAccounts);
    if (!IMPORTED_KINDS.includes(classified.kind)) {
      note(SKIP_REASONS[classified.kind as 'transfer' | 'dividend']);
      continue;
    }
    if (!row.externalId) { note('No archive reference — cannot be de-duplicated'); continue; }
    if (!row.date) { note(`Unreadable date "${row.dateText}"`); continue; }
    if (!Number.isFinite(row.amount) || row.amount <= 0) { note('Unreadable or zero amount'); continue; }
    if (row.currency !== 'EUR') { note(`Not in EUR (${row.currency})`); continue; }

    candidates.push({
      date: row.date,
      amount: row.amount,
      type: row.direction,
      category: classified.category as string,
      note: [row.counterparty, row.description].filter(Boolean).join(' · ').slice(0, 300),
      externalId: row.externalId,
      userId: options.userId,
      ...(options.groupId ? { groupId: options.groupId } : {})
    });
  }

  const dates = rows.map((r) => r.date).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
  const period = dates.length
    ? { from: dates[0].toISOString().slice(0, 10), to: dates[dates.length - 1].toISOString().slice(0, 10) }
    : null;

  if (candidates.length === 0) {
    return { format: 'seb', imported: 0, duplicates: 0, skipped, period, rows: rows.length, categories: [] };
  }

  // One query rather than one per row: which references are already held?
  const existing = await Transaction.find(
    {
      ...tenantScope(options.userId, options.groupId ? [options.groupId] : []),
      externalId: { $in: candidates.map((c) => c.externalId) }
    },
    { externalId: 1 }
  ).lean();

  const held = new Set(existing.map((e) => e.externalId));
  const fresh = candidates.filter((c) => !held.has(c.externalId));

  if (fresh.length > 0) {
    // Upsert rather than insert: a row could arrive between the check above and
    // this write, and the unique index would otherwise abort the whole batch.
    await Transaction.bulkWrite(
      fresh.map((t) => ({
        updateOne: {
          filter: { userId: t.userId, externalId: t.externalId },
          update: { $set: t },
          upsert: true
        }
      })),
      { ordered: false }
    );
  }

  const byCategory = new Map<string, { count: number; amount: number }>();
  for (const t of fresh) {
    const bucket = byCategory.get(t.category) || { count: 0, amount: 0 };
    bucket.count++;
    bucket.amount += t.amount;
    byCategory.set(t.category, bucket);
  }

  return {
    format: 'seb',
    imported: fresh.length,
    duplicates: candidates.length - fresh.length,
    skipped,
    period,
    rows: rows.length,
    categories: [...byCategory.entries()]
      .map(([category, b]) => ({ category, ...b }))
      .sort((a, b) => b.amount - a.amount)
  };
};

// ---------------------------------------------------------------------------
// Categorising round trip
// ---------------------------------------------------------------------------

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

/** Which of the two shapes a file is, or null when it is neither. */
export function detectFormat(text: string): TransactionFileFormat | null {
  if (isCategoryFile(text)) return 'tumbaland';
  if (isAccountStatement(text)) return 'seb';
  return null;
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
  const changes: Array<{ id: string; category: string }> = [];
  let unchanged = 0;

  for (const [id, category] of wanted) {
    const current = held.get(id);
    if (current === undefined) continue;
    if (current === category) { unchanged++; continue; }
    changes.push({ id, category });
  }

  if (changes.length > 0) {
    await Transaction.bulkWrite(
      changes.map((change) => ({
        updateOne: { filter: { _id: change.id }, update: { $set: { category: change.category } } }
      })),
      { ordered: false }
    );
  }

  const byCategory = new Map<string, number>();
  for (const change of changes) {
    byCategory.set(change.category, (byCategory.get(change.category) || 0) + 1);
  }

  return {
    format: 'tumbaland',
    kind: 'categories',
    updated: changes.length,
    unchanged,
    notFound: wanted.size - held.size,
    malformed,
    categories: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  };
};
