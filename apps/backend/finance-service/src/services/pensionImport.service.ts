import Transaction from '../models/Transaction';
import { BadRequestError, assertMemberOf } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import { readPensionStatement, Pillar, PensionContribution } from './pensionStatement.service';
import type { ImportOptions } from './importTypes';

// Pension contributions from a Pensionikeskus statement.

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
  assertMemberOf(options.groupId, options.userGroups);

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
