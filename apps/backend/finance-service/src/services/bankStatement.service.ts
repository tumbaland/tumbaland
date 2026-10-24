import { TransactionType } from '../models/Transaction';
import { MatchType } from '../models/CategoryRule';

/**
 * Reader for SEB internet-bank CSV account statements.
 *
 * This is the canonical implementation — the API import and the one-off
 * migration scripts both use it, so the rules for what counts as real income or
 * spending live in exactly one place.
 *
 * Format:
 *   - semicolon separated, UTF-8 with BOM, fields inconsistently quoted
 *   - Summa uses a comma decimal separator and is always positive
 *   - Deebet/Kreedit (D/C) carries the direction
 *   - Kuupäev is DD.MM.YYYY
 *   - Arhiveerimistunnus is unique per row and stable across re-exports, which
 *     is what lets the same statement be imported twice without duplicating
 */

export interface StatementRow {
  account: string;
  date: Date | null;
  dateText: string;
  counterpartyAccount: string;
  counterparty: string;
  direction: TransactionType;
  amount: number;
  externalId: string;
  description: string;
  currency: string;
}

/** Minimal RFC4180-ish reader; descriptions contain semicolons, so no split(). */
export function parseCsv(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** "15,59" / "1 234,56" → 15.59 / 1234.56 */
export function parseAmount(value: string): number {
  const parsed = parseFloat(String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** "05.08.2026" → Date at UTC midnight, so no timezone can shift the day. */
export function parseStatementDate(value: string): Date | null {
  const [day, month, year] = String(value).split('.').map(Number);
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

const ACCOUNT_HEADER = 'Kliendi konto';

/** True when the text looks like a SEB account statement rather than some other CSV. */
export function isAccountStatement(text: string): boolean {
  const [header] = parseCsv(text.replace(/^\uFEFF/, ''));
  return !!header && header.map((h) => h.trim()).includes(ACCOUNT_HEADER);
}

export function readStatement(text: string): StatementRow[] {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) return [];

  const columns = header.map((h) => h.trim());
  if (!columns.includes(ACCOUNT_HEADER)) return [];

  return body.map((cells) => {
    const raw: Record<string, string> = {};
    columns.forEach((column, index) => { raw[column] = (cells[index] || '').trim(); });

    return {
      account: raw[ACCOUNT_HEADER] || '',
      date: parseStatementDate(raw['Kuupäev']),
      dateText: raw['Kuupäev'] || '',
      counterpartyAccount: raw['Saaja/maksja konto'] || '',
      counterparty: raw['Saaja/maksja nimi'] || '',
      direction: raw['Deebet/Kreedit (D/C)'] === 'C' ? 'income' : 'expense',
      amount: parseAmount(raw['Summa']),
      externalId: raw['Arhiveerimistunnus'] || '',
      description: raw['Selgitus'] || '',
      currency: raw['Valuuta'] || 'EUR'
    };
  });
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const PENSION = /PENSIONIKESKUS/i;
const SETTLEMENT = /^DL[A-Z0-9]+\//i;
const DIVIDEND = /dividendimak/i;

/**
 * Tests whether a counterparty is the account holder themselves.
 *
 * Always supplied by the caller, which reads the names from the owner's
 * settings. Never a constant here and never read from the environment: it is a
 * real person's name, so it belongs neither in a repository nor in one global
 * value shared by every owner the service serves.
 */
export type OwnerNameTest = (counterparty: string) => boolean;

/** Fold accents, drop case, collapse runs of whitespace. */
const normalizeName = (text: string): string =>
  fold(text).toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * Build the test from the names an owner has recorded.
 *
 * Plain substring matching rather than a pattern: a name is a name, and this
 * way nothing the owner types is ever compiled. With no names recorded the test
 * is null, and own-account detection falls back to the account numbers the
 * statement carries on its own — which still catches every transfer between two
 * accounts the statements cover, and misses only an account of the owner's that
 * appears solely as a counterparty.
 */
export function ownerNameTest(names: string[] = []): OwnerNameTest | null {
  const wanted = names.map(normalizeName).filter(Boolean);
  if (wanted.length === 0) return null;

  return (counterparty: string) => {
    const haystack = normalizeName(counterparty);
    return wanted.some((name) => haystack.includes(name));
  };
}

/**
 * Every account belonging to the statement's owner, gathered from both sides:
 * the accounts the statements are *for*, plus any counterparty account a row
 * addresses by the owner's own name.
 *
 * A transfer between two own accounts appears twice — once as a debit, once as
 * a credit — so counting either leg as income or spending corrupts the totals.
 */
export function findOwnAccounts(
  rows: StatementRow[],
  isOwner: OwnerNameTest | null = null
): Set<string> {
  const accounts = new Set(rows.map((r) => r.account).filter(Boolean));
  if (!isOwner) return accounts;

  for (const row of rows) {
    if (row.counterpartyAccount && isOwner(row.counterparty)) {
      accounts.add(row.counterpartyAccount);
    }
  }
  return accounts;
}

/**
 * Where the categorisation rules went.
 *
 * They used to be an array right here: forty-odd regular expressions naming the
 * owner's employers and the dates they worked there, their pharmacy, their
 * bank, and every merchant they buy from. That is one person's financial and
 * employment history sitting in a source file, which is fine in a private
 * repository and a disclosure in a public one.
 *
 * They now live in the `categoryrules` collection, per owner, editable from the
 * Cash Flow page — so this file is generic code again, and a correction takes
 * effect on the next import instead of on the next deploy.
 *
 * `scripts/migration/export-category-rules.js` lifted the original list out;
 * `import-category-rules.js` loads it back. A fresh install ships with no rules
 * at all and files everything as Uncategorised until the owner writes some,
 * which is the honest default: a stranger's merchant list is not a sensible
 * guess about anyone else's spending.
 */

/**
 * Categories that move capital between the account and an asset.
 *
 * They appear in both directions — a purchase leaves the account, a sale or a
 * maturing deposit comes back — and neither direction is spending or earning.
 * The analytics net them into a single "invested" figure so the savings rate
 * measures what it claims to: earnings kept rather than consumed.
 */
export const INVESTMENT_CATEGORIES = new Set(['Investments', 'Savings', 'Pension']);

/**
 * Everything kept out of the income figure: capital returning is the same money
 * coming back, not earnings.
 */
export const NON_EARNING_CATEGORIES = new Set(INVESTMENT_CATEGORIES);

export const FALLBACK_CATEGORY: Record<TransactionType, string> = {
  income: 'Other income',
  expense: 'Uncategorised'
};

/**
 * The categories a row lands in when nothing claimed it — the backlog a new
 * rule is usually written to clear.
 */
export const FALLBACK_CATEGORIES = new Set(Object.values(FALLBACK_CATEGORY));

/**
 * Strip diacritics so a rule matches however the bank spelled the name.
 *
 * Card rows arrive transliterated by the terminal — a name spelled Külapood
 * comes through as KULAPOOD, and Ülemiste as YLEMISTE — while transfer rows
 * keep the real spelling. A rule written either way misses half its rows, which
 * is how a merchant can sit in Uncategorised for years.
 *
 * Applied to the patterns as well as the text, so rules stay readable in
 * correct Estonian. Only letters are rewritten, so regex syntax survives.
 */
export const fold = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * A stored rule, prepared for matching.
 *
 * `pattern` is kept alongside the compiled form so a caller can report which
 * rule fired in the words it was written in.
 */
export interface CompiledRule {
  pattern: string;
  /** Substring rules: folded and lowercased. Regex rules: the folded source. */
  needle: string;
  /** Set for regex rules only. */
  expression?: RegExp;
  category: string;
  type?: TransactionType;
}

export interface RuleSource {
  pattern: string;
  matchType?: MatchType;
  category: string;
  type?: TransactionType;
}

/**
 * Prepare stored rules for matching, dropping any that cannot match.
 *
 * A regex that no longer parses is skipped rather than thrown on: one bad rule
 * must not take down an import of ten thousand rows, and the alternative is an
 * error naming a pattern the owner cannot see from the failure.
 */
export function compileRules(rules: RuleSource[]): CompiledRule[] {
  const compiled: CompiledRule[] = [];

  for (const rule of rules) {
    const folded = fold(rule.pattern).trim();
    if (!folded) continue;

    if (rule.matchType === 'regex') {
      try {
        compiled.push({
          pattern: rule.pattern,
          needle: folded,
          expression: new RegExp(folded, 'i'),
          category: rule.category,
          type: rule.type
        });
      } catch {
        continue;
      }
      continue;
    }

    compiled.push({
      pattern: rule.pattern,
      needle: folded.toLowerCase(),
      category: rule.category,
      type: rule.type
    });
  }

  return compiled;
}

/**
 * The first stored rule that claims this text, or null.
 *
 * `haystack` must already be folded \u2014 callers match many rows against the same
 * rules and folding per row per rule would repeat the work needlessly.
 */
export function matchCustomRule(
  rules: CompiledRule[],
  haystack: string,
  direction: TransactionType
): CompiledRule | null {
  const lowered = haystack.toLowerCase();
  for (const rule of rules) {
    if (rule.type && rule.type !== direction) continue;
    const hit = rule.expression ? rule.expression.test(haystack) : lowered.includes(rule.needle);
    if (hit) return rule;
  }
  return null;
}

/**
 * Which category a row belongs to.
 *
 * The owner's rules are the whole story \u2014 the first that claims the row wins,
 * which is why their order is theirs to set \u2014 and anything nothing claims lands
 * in the fallback for its direction, where the Cash Flow page can offer it up
 * to be sorted.
 */
export function categorize(row: StatementRow, rules: CompiledRule[] = []): string {
  const haystack = fold(`${row.counterparty} ${row.description}`);

  const match = matchCustomRule(rules, haystack, row.direction);
  return match ? match.category : FALLBACK_CATEGORY[row.direction];
}

export type RowKind = 'cashflow' | 'transfer' | 'security' | 'dividend' | 'pension';

/**
 * What a row *is*, which decides whether it becomes a transaction.
 *
 *   transfer  — between the owner's own accounts; neutral, never imported
 *   security  — a buy or sell settlement; belongs in the trade log
 *   dividend  — fund income; belongs in the trade log
 *   pension   — buys a fund unit, so an asset purchase rather than spending
 *   cashflow  — ordinary income or expense
 */
export function classifyRow(
  row: StatementRow,
  ownAccounts: Set<string>,
  /**
   * Stored rules decide the *category* of an ordinary row, not what kind of row
   * it is: whether something is a transfer between the owner's own accounts or
   * a securities settlement is a structural fact about the statement, and a
   * category rule has no business overruling it.
   */
  rules: CompiledRule[] = [],
  isOwner: OwnerNameTest | null = null
): { kind: RowKind; category?: string } {
  if (ownAccounts.has(row.counterpartyAccount) || isOwner?.(row.counterparty)) {
    return { kind: 'transfer' };
  }
  if (DIVIDEND.test(row.description)) return { kind: 'dividend' };

  // A securities settlement and a pension contribution are cash movements as
  // well as position changes: the money really did leave the account, and
  // leaving them out made "invested per year" report a fraction of the truth.
  // They land in a capital category, so they count as invested without ever
  // being mistaken for spending. The trade importer reads settlements from the
  // same statements independently — one event, two ledgers.
  if (SETTLEMENT.test(row.description)) return { kind: 'security', category: 'Investments' };
  if (PENSION.test(row.counterparty)) return { kind: 'pension', category: 'Pension' };

  return { kind: 'cashflow', category: categorize(row, rules) };
}
