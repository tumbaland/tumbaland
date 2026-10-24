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
import { applyCategoryChanges, getCompiledRules, CategoryChange } from './categoryRule.service';
import { getOwnerNameTest } from './statementSettings.service';
import {
  readPensionStatement,
  isPensionStatement,
  Pillar,
  PensionContribution
} from './pensionStatement.service';

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
export type TransactionFileFormat = 'seb' | 'tumbaland' | 'pensionikeskus';

export const FORMAT_LABELS: Record<TransactionFileFormat, string> = {
  seb: 'SEB account statement',
  tumbaland: 'Tumbaland export',
  pensionikeskus: 'Pensionikeskus account statement'
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
  for (const row of rows) {
    const classified = classifyRow(row, ownAccounts, rules, isOwner);
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

  return {
    format: 'seb',
    imported: fresh.length,
    duplicates: candidates.filter((c) => held.has(c.externalId)).length,
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

/** Which shape a file is, or null when it is none of them. */
export function detectFormat(text: string): TransactionFileFormat | null {
  if (isCategoryFile(text)) return 'tumbaland';
  if (isAccountStatement(text)) return 'seb';
  if (isPensionStatement(text)) return 'pensionikeskus';
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

// ---------------------------------------------------------------------------
// Pension contributions
// ---------------------------------------------------------------------------

/**
 * How far apart a fund subscription and the bank transfer that paid for it can
 * sit and still be the same money. Observed lag is two to four days — the
 * transfer clears, then the units are priced.
 */
const SETTLEMENT_DAYS = 7;

export interface PensionImportResult {
  format: 'pensionikeskus';
  kind: 'pension';
  /** Contributions written as new transactions. */
  imported: number;
  /** Already held from an earlier import of an overlapping period. */
  duplicates: number;
  /** III pillar contributions already present as the bank transfer that paid them. */
  coveredByBank: number;
  /** Every subscription the file contained. */
  contributions: number;
  skipped: Record<string, number>;
  period: { from: string; to: string } | null;
  funds: string[];
  byPillar: Array<{ pillar: Pillar; count: number; amount: number; action: string }>;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * A stable id for a contribution the bank never saw.
 *
 * Keyed on pillar, day and amount rather than on anything the registry
 * supplies, because the export carries no reference of its own — so
 * re-importing an overlapping period recognises what it already has instead of
 * doubling every month.
 */
const pensionId = (c: PensionContribution) => `pension:${c.pillar}:${day(c.date)}:${c.amount}`;

/**
 * Import pension contributions from a Pensionikeskus statement.
 *
 * The two pillars need opposite treatment, which is the whole reason this is
 * not just another statement import:
 *
 * II pillar is deducted from gross pay and never touches a bank account, so
 * nothing else can ever record it. It is written as a *pair* — the money going
 * into the fund, and the same amount as the pay it came out of. Writing only
 * the outgoing leg would show money leaving an account that never received it,
 * dragging the savings rate down by the whole contribution.
 *
 * III pillar is paid by bank transfer to Pensionikeskus, which the account
 * statement already records. Importing it again would count it twice, so each
 * one is matched against the transfer that paid for it and only genuinely
 * unmatched contributions are written — those are money that moved through an
 * account the statements do not cover.
 */
export const importPensionStatement = async (
  csv: string,
  options: ImportOptions
): Promise<PensionImportResult> => {
  if (options.groupId && !(options.userGroups || []).includes(options.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const { contributions, skipped, funds } = readPensionStatement(csv);
  if (contributions.length === 0) {
    throw new BadRequestError(
      'No contributions found. The statement needs "Osakute märkimine" rows — ' +
      'the other row types are the same money on its way to the fund.'
    );
  }

  // Two different shapes: a filter for reading what is already held, and the
  // plain owner fields a new document is written with.
  const scope = tenantScope(options.userId, options.groupId ? [options.groupId] : []);
  const owner = {
    userId: options.userId,
    ...(options.groupId ? { groupId: options.groupId } : {})
  };
  const from = contributions[0].date;
  const to = contributions[contributions.length - 1].date;

  // Every pension row already held over the period the file covers, widened by
  // the settlement lag so a transfer just outside the range still matches.
  const window = (date: Date, days: number) => new Date(+date + days * 86400000);
  const existing = await Transaction.find({
    ...scope,
    category: 'Pension',
    date: { $gte: window(from, -SETTLEMENT_DAYS), $lte: window(to, SETTLEMENT_DAYS) }
  }).lean();

  const heldIds = new Set(existing.map((t) => t.externalId).filter(Boolean));
  // Bank-paid rows only: a previously imported II pillar pair must not be
  // mistaken for the bank transfer that would make a contribution redundant.
  const bankPaid = existing.filter(
    (t) => t.type === 'expense' && !String(t.externalId || '').startsWith('pension:')
  );
  const claimed = new Set<string>();

  const coveredByTransfer = (c: PensionContribution) =>
    bankPaid.some((t) => {
      const id = String(t._id);
      if (claimed.has(id)) return false;
      const apart = Math.abs(+new Date(t.date) - +c.date) / 86400000;
      if (apart > SETTLEMENT_DAYS || Math.abs(t.amount - c.amount) > 0.01) return false;
      claimed.add(id);
      return true;
    });

  const rows: Array<Record<string, unknown>> = [];
  let duplicates = 0;
  let coveredByBank = 0;
  const imported: PensionContribution[] = [];

  for (const c of contributions) {
    const id = pensionId(c);
    if (heldIds.has(id)) { duplicates++; continue; }
    if (c.pillar === 'III' && coveredByTransfer(c)) { coveredByBank++; continue; }

    const base = { date: c.date, amount: c.amount, ...owner };
    rows.push({
      ...base,
      type: 'expense',
      category: 'Pension',
      note: `${c.fund} · ${c.pillar} pillar contribution`,
      externalId: id
    });
    // Only II pillar gets the gross-pay leg: III pillar was paid out of money
    // that already arrived as income, so adding it would count that income twice.
    if (c.pillar === 'II') {
      rows.push({
        ...base,
        type: 'income',
        category: 'Salary',
        note: `${c.fund} · ${c.pillar} pillar, deducted from gross pay`,
        externalId: `${id}:gross`
      });
    }
    imported.push(c);
  }

  if (rows.length > 0) await Transaction.insertMany(rows, { ordered: false });

  const byPillar = (['II', 'III'] as Pillar[])
    .map((pillar) => {
      const mine = contributions.filter((c) => c.pillar === pillar);
      return {
        pillar,
        count: mine.length,
        amount: Math.round(mine.reduce((sum, c) => sum + c.amount, 0) * 100) / 100,
        action:
          pillar === 'II'
            ? 'Imported — never appears on a bank statement'
            : 'Already paid by bank transfer; only unmatched ones imported'
      };
    })
    .filter((p) => p.count > 0);

  return {
    format: 'pensionikeskus',
    kind: 'pension',
    imported: imported.length,
    duplicates,
    coveredByBank,
    contributions: contributions.length,
    skipped,
    period: { from: day(from), to: day(to) },
    funds,
    byPillar
  };
};
