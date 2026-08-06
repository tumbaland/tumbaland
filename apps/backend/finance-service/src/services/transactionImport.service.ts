import Transaction from '../models/Transaction';
import { BadRequestError, ForbiddenError } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import {
  readStatement,
  isAccountStatement,
  findOwnAccounts,
  classifyRow,
  RowKind
} from './bankStatement.service';

export interface ImportResult {
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

const SKIP_REASONS: Record<Exclude<RowKind, 'cashflow'>, string> = {
  transfer: 'Transfer between your own accounts',
  security: 'Securities settlement (belongs in the trade log)',
  dividend: 'Dividend (belongs in the trade log)',
  pension: 'Pension contribution (buys a fund unit, not spending)'
};

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
    if (classified.kind !== 'cashflow') {
      note(SKIP_REASONS[classified.kind]);
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
    return { imported: 0, duplicates: 0, skipped, period, rows: rows.length, categories: [] };
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
