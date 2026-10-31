import Transaction from '../models/Transaction';
import { BadRequestError, assertMemberOf } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import {
  readStatement,
  isAccountStatement,
  findOwnAccounts,
  classifyRow,
  RowKind
} from './bankStatement.service';
import { getCompiledRules } from './categoryRule.service';
import { getOwnerNameTest } from './statementSettings.service';
import { isPensionStatement } from './pensionStatement.service';
import { isCategoryFile } from './categoryImport.service';
import type { TransactionFileFormat, ImportOptions } from './importTypes';
import { importTrades, TradeImportResult, TradeRow, EMPTY_TRADE_IMPORT } from './tradeImport.service';

// The three importers each live in their own file; this module is the one place
// the controller reads them from, and the home of the bank statement import.
export { FORMAT_LABELS } from './importTypes';
export type { TransactionFileFormat, ImportOptions } from './importTypes';
export { isCategoryFile, importCategories } from './categoryImport.service';
export type { CategoryImportResult } from './categoryImport.service';
export { importPensionStatement } from './pensionImport.service';
export type { PensionImportResult } from './pensionImport.service';

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
  /** What the securities rows of the file did to the trade log. */
  trades: TradeImportResult;
}

const TRANSFER_REASON = 'Transfer between your own accounts';

/**
 * Rows that become transactions. Securities settlements and pension
 * contributions are included because the money genuinely left the account —
 * excluding them made the invested figure report a fraction of the truth — and
 * they carry a capital category, so they never read as spending. A dividend is
 * included because it is income that arrived, in a category of its own.
 */
const IMPORTED_KINDS: RowKind[] = ['cashflow', 'security', 'pension', 'dividend'];

/** Which shape a file is, or null when it is none of them. */
export function detectFormat(text: string): TransactionFileFormat | null {
  if (isCategoryFile(text)) return 'tumbaland';
  if (isAccountStatement(text)) return 'seb';
  if (isPensionStatement(text)) return 'pensionikeskus';
  return null;
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
  assertMemberOf(options.groupId, options.userGroups);

  const rows = readStatement(csv);
  if (rows.length === 0) {
    throw new BadRequestError('No data rows found in the file');
  }

  const userGroups = options.groupId ? [options.groupId] : [];
  // How this owner's own name appears on their statements, so a transfer
  // between two of their accounts is not counted as income or spending.
  const isOwner = await getOwnerNameTest(options.userId, userGroups);
  const ownAccounts = findOwnAccounts(rows, isOwner);
  const skipped: Record<string, number> = {};
  const note = (reason: string) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  // Loaded once for the whole file. These are the corrections the owner has
  // already made, and applying them here is what stops a merchant the built-in
  // rules do not know from arriving in Uncategorised every single month.
  const rules = await getCompiledRules(options.userId, userGroups);

  const candidates = [];
  // Settlements and dividends are also trade-log events; collected here and
  // handed over once the cash side is written.
  const tradeRows: TradeRow[] = [];
  for (const row of rows) {
    const classified = classifyRow(row, ownAccounts, rules, isOwner);
    if (classified.kind === 'security' || classified.kind === 'dividend') {
      tradeRows.push({ row, kind: classified.kind });
    }
    if (classified.kind === 'transfer') { note(TRANSFER_REASON); continue; }
    if (!IMPORTED_KINDS.includes(classified.kind)) continue;
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
    const trades = await importTrades(tradeRows, options);
    return { format: 'seb', imported: 0, duplicates: 0, skipped, period, rows: rows.length, categories: [], trades };
  }

  // One query rather than one per row: which references are already held,
  // here or by this person anywhere else? A reference is unique per person
  // (see the Transaction model), not per context, so a row they imported under
  // their personal finances cannot be imported into a group too, and the
  // reverse. Looking only in the current context used to miss those, and the
  // write below then moved the personal rows into the group, corrections and
  // all.
  const existing = await Transaction.find(
    {
      externalId: { $in: candidates.map((c) => c.externalId) },
      $or: [tenantScope(options.userId, options.groupId ? [options.groupId] : []), { userId: options.userId }]
    },
    { externalId: 1, groupId: 1 }
  ).lean();

  const inThisContext = (row: { groupId?: string | null }) =>
    options.groupId ? row.groupId === options.groupId : !row.groupId;
  const held = new Set(existing.filter(inThisContext).map((e) => e.externalId));
  const elsewhere = new Map(
    existing.filter((e) => !inThisContext(e)).map((e) => [e.externalId, e.groupId ? 'a group' : 'your personal finances'])
  );

  const fresh = candidates.filter((c) => {
    if (held.has(c.externalId)) return false;
    const where = elsewhere.get(c.externalId);
    if (where) {
      note(`Already imported under ${where}`);
      return false;
    }
    return true;
  });

  if (fresh.length > 0) {
    // Upsert rather than insert: a row could arrive between the check above and
    // this write, and the unique index would otherwise abort the whole batch.
    // `$setOnInsert`, so a row that did slip in is left exactly as it is.
    await Transaction.bulkWrite(
      fresh.map((t) => ({
        updateOne: {
          filter: { userId: t.userId, externalId: t.externalId },
          update: { $setOnInsert: t },
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

  const trades = tradeRows.length > 0 ? await importTrades(tradeRows, options) : { ...EMPTY_TRADE_IMPORT };

  return {
    format: 'seb',
    imported: fresh.length,
    duplicates: candidates.filter((c) => held.has(c.externalId)).length,
    skipped,
    period,
    rows: rows.length,
    categories: [...byCategory.entries()]
      .map(([category, b]) => ({ category, ...b }))
      .sort((a, b) => b.amount - a.amount),
    trades
  };
};
