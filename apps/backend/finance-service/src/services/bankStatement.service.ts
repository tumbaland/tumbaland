import { TransactionType } from '../models/Transaction';

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

/**
 * The account holder's name, in either order — the bank writes it both ways
 * depending on the channel, and matching only one lets a transfer between the
 * owner's own accounts through as if it were real spending.
 */
export const OWNER_NAME = /(TAHVES\s+TOOMAS|TOOMAS\s+TAHVES)/i;

const PENSION = /PENSIONIKESKUS/i;
const SETTLEMENT = /^DL[A-Z0-9]+\//i;
const DIVIDEND = /dividendimak/i;

/**
 * Every account belonging to the statement's owner, gathered from both sides:
 * the accounts the statements are *for*, plus any counterparty account a row
 * addresses by the owner's own name.
 *
 * A transfer between two own accounts appears twice — once as a debit, once as
 * a credit — so counting either leg as income or spending corrupts the totals.
 */
export function findOwnAccounts(rows: StatementRow[]): Set<string> {
  const accounts = new Set(rows.map((r) => r.account).filter(Boolean));
  for (const row of rows) {
    if (row.counterpartyAccount && OWNER_NAME.test(row.counterparty)) {
      accounts.add(row.counterpartyAccount);
    }
  }
  return accounts;
}

interface CategoryRule {
  category: string;
  type?: TransactionType;
  match: RegExp;
}

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'Salary', type: 'income', match: /TEHNIKAÜLIKOOL|TALTECH/i },
  { category: 'Freelance', type: 'income', match: /Brainbase|ESTNETI/i },
  { category: 'Tax refund', type: 'income', match: /RAHANDUSMINISTEERIUM/i },

  // Capital moving to and from an asset, in either direction. A term deposit
  // maturing is the principal coming back, not interest — counting the whole
  // "january payment" as income overstated earnings by tens of thousands — and
  // a crypto withdrawal is the same money returning, not a salary.
  { category: 'Investments', match: /Binance|COINBASE|Kraken|Bitstamp|Interactive Brokers|Lightyear/i },
  { category: 'Savings', match: /BIGBANK|Bigbank/i },
  { category: 'Pension', match: /PENSIONIKESKUS/i },
  // Actual interest, which is earnings and stays in the income figure
  { category: 'Interest', type: 'income', match: /Intresside väljamaks/i },
  // Cash paid in over the counter. Named rather than lumped into "other
  // income" because it is worth eyeballing: deposits here run several times
  // the ATM withdrawals, so most of it arrived from outside rather than being
  // unspent cash coming back, and it counts as income until shown otherwise.
  { category: 'Cash deposit', type: 'income', match: /SISSEMAKSE/i },

  { category: 'Groceries', match: /RIMI|SELVER|PRISMA|MAXIMA|COOP|\bICA\b|LIDL|Grocery/i },
  { category: 'Housing', match: /KÜ |Korteriühistu|ELEKTRILEVI|EESTI ENERGIA|Utilitas|Tallinna Vesi/i },
  { category: 'Transport', match: /Circle K|Neste|Olerex|Alexela|BOLT|TAXI|Linnatransport|Elron|EUROPARK|VIKING MOTORS/i },
  { category: 'Telecom', match: /STV AS|Telia|Elisa|Tele2/i },
  { category: 'Travel', match: /AIR BALTIC|BOOKING|RYANAIR|Wizz|Hotel|AIRBNB|LUX EXPRESS|SONDER\.COM/i },
  { category: 'Health', match: /Unimed|Apotheka|Benu|Südameapteek|Confido|Qvalitas|Stebby|MELIVA|MY FITNESS/i },
  { category: 'Electronics', match: /Arvutitark|Euronics|Klick|On24|Photopoint/i },
  { category: 'Home', match: /DEPO|Bauhof|K-Rauta|Ehituse ABC|JYSK|IKEA|Fauni/i },
  { category: 'Restaurants', match: /Restoran|Kohvik|Cafe|Pizza|Sushi|McDonald|Burger|Wolt|Bolt Food/i },
  { category: 'Cash', match: /BRINK'S|\bATM\b|Sularaha/i },
  { category: 'Bank fees', match: /Teenustasu|Igapäevane pakett|Intressi tulumaks|VP H\.TASU/i },
  { category: 'Tax', type: 'expense', match: /RAHANDUSMINISTEERIUM|MAKSU- JA TOLLIAMET/i },
  { category: 'Subscriptions', match: /Spotify|Netflix|Google|Apple\.com|Microsoft|Amazon|Patreon|Steam/i }
];

/**
 * Categories that move capital between the account and an asset.
 *
 * They appear in both directions — a purchase leaves the account, a sale or a
 * maturing deposit comes back — and neither direction is spending or earning.
 * The analytics net them into a single "invested" figure so the savings rate
 * measures what it claims to: earnings kept rather than consumed.
 */
export const INVESTMENT_CATEGORIES = new Set(['Investments', 'Savings', 'Pension']);

export const isInvestmentCategory = (category: string): boolean =>
  INVESTMENT_CATEGORIES.has(category);

/**
 * Everything kept out of the income figure: capital returning is the same money
 * coming back, not earnings.
 */
export const NON_EARNING_CATEGORIES = new Set([...INVESTMENT_CATEGORIES]);

export const FALLBACK_CATEGORY: Record<TransactionType, string> = {
  income: 'Other income',
  expense: 'Uncategorised'
};

export function categorize(row: StatementRow): string {
  const haystack = `${row.counterparty} ${row.description}`;
  for (const rule of CATEGORY_RULES) {
    if (!rule.match.test(haystack)) continue;
    if (rule.type && rule.type !== row.direction) continue;
    return rule.category;
  }
  return FALLBACK_CATEGORY[row.direction];
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
  ownAccounts: Set<string>
): { kind: RowKind; category?: string } {
  if (ownAccounts.has(row.counterpartyAccount) || OWNER_NAME.test(row.counterparty)) {
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

  return { kind: 'cashflow', category: categorize(row) };
}
