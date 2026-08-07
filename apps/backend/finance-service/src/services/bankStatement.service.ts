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
  // Wages, however the payer worded it. "Töötasu" and "Palgamakse" are the
  // Estonian terms and say outright what the payment is, so they hold for an
  // employer nobody has named a rule after yet.
  { category: 'Salary', type: 'income', match: /Töötasu|Palgamakse/i },
  // Employers by name, for the ones that reference only an invoice number.
  // ESTNETI OÜ is Betsson's paying entity (Jul 2019 – Oct 2020); Brainbase
  // followed (Nov 2020 – Jun 2022). Both were jobs, not contract work — filing
  // them as freelance made a continuous decade of employment look broken up.
  { category: 'Salary', type: 'income', match: /TEHNIKAÜLIKOOL|TALTECH|Brainbase|ESTNETI/i },
  { category: 'Tax refund', type: 'income', match: /RAHANDUSMINISTEERIUM/i },

  // Capital moving to and from an asset, in either direction: a term deposit
  // maturing is the principal coming back, and a crypto withdrawal is the same
  // money returning, neither of them earnings.
  //
  // The counterparty's name alone does not settle it, and reading it that way
  // is what went wrong with Bigbank below — a name can be an employer and a
  // deposit provider at once.
  { category: 'Investments', match: /Binance|COINBASE|Kraken|Bitstamp|Interactive Brokers|Lightyear/i },
  // Paysafe owns Skrill and Neteller, and this is the crypto money coming back
  // by a different road than it left by. Reading it as income left €4,000 sent
  // to Binance in May 2021 with no return leg — the only unexplained inflow in
  // ten years of statements — and showed a crypto holding that does not exist.
  // Counting it closes the position at €622 ahead of what went in.
  //
  // The bank data cannot prove the link: every other Binance withdrawal came
  // through Clear Junction saying "Withdrawal from Binance", while this one
  // arrives from Luxembourg carrying only a transaction reference. It rests on
  // the amounts reconciling and on the account holder's own account of it.
  { category: 'Investments', match: /Paysafe/i },
  // Bigbank was an employer from Aug 2022 to Jul 2023 and a deposit provider
  // besides, and the two arrive from different accounts. Reading the whole
  // name as capital buried a year of salary: "tasu" is a fee, "lõpparve" the
  // final wage settlement, and both were being netted out of income as though
  // a term deposit had matured.
  //
  // \btasu\b and not /tasu/ — the bank's own "Teenustasu" and "hooldustasu"
  // must not read as pay.
  { category: 'Salary', type: 'income', match: /BIGBANK.*\btasu\b|BIGBANK.*lõpparve/i },
  // Reimbursements and the employer-funded wellness benefit reverse spending
  // rather than adding to pay.
  { category: 'Refund', type: 'income', match: /Cost report.*TAHVES|compensated by Bigbank/i },
  // What is left is the deposit relationship: a term deposit going out and the
  // principal, or an early termination, coming back.
  { category: 'Savings', match: /BIGBANK|Bigbank/i },
  { category: 'Pension', match: /PENSIONIKESKUS/i },
  // Actual interest, which is earnings and stays in the income figure
  { category: 'Interest', type: 'income', match: /Intresside väljamaks/i },
  // Cash paid in over the counter. Named rather than lumped into "other
  // income" because it is worth eyeballing: deposits here run several times
  // the ATM withdrawals, so most of it arrived from outside rather than being
  // unspent cash coming back, and it counts as income until shown otherwise.
  { category: 'Cash deposit', type: 'income', match: /SISSEMAKSE/i },

  // Funding the brokerage account. IBKR takes EUR deposits through Citibank's
  // Germany branch and the row carries the U-prefixed IBKR account number, so
  // this is capital moving to an asset rather than a payment to a bank.
  { category: 'Investments', match: /CITIBANK EUROPE.*GERMANY/i },

  // A returned order coming back is not earnings. Estonian invoicing language:
  // "tagastus" is a refund, "krd.arve" a credit note.
  { category: 'Refund', type: 'income', match: /raha tagastus|Tag\. tell|tagastus|krd\.arve|loobus kaubast/i },

  // "hooldustasu" on its own is any maintenance fee — the Housing rule wants
  // the apartment association's, so the card's monthly fee is claimed first.
  { category: 'Bank fees', match: /Teenustasu|Igapäevane pakett|Intressi tulumaks|VP H\.TASU|Kaardi .*hooldustasu/i },
  { category: 'Tax', type: 'expense', match: /RAHANDUSMINISTEERIUM|MAKSU- JA TOLLIAMET/i },
  { category: 'Cash', match: /BRINK'S|\bATM\b|Sularaha|VÄLJAMAKSE/i },

  // Pharmacies, clinics and opticians. The terminal transliterates ü as either
  // u or y, hence the character classes — see fold() below.
  {
    category: 'Health',
    match:
      /Unimed|Apotheka|\bBenu\b|S[üy]dameapteek|APTEEK|KESKUSE APTE|NETIAPTEEK|Farmacia|Confido|Qvalitas|Stebby|MELIVA|MY ?FITNESS|Hambakliinik|HAMBALASER|Arstikeskus|Polikliinik|POLIKLIINIKU|PROFDIAGNOSTIK|Mediron|INSTRUMENTARIUM|LENS OPTIKA|HARUAPTEEK/i
  },
  { category: 'Personal care', match: /Ilusalong|KOSMEETIKA|notino|L COSMETICS|\bI\.L\.U\.|CHLOE ILU/i },
  { category: 'Pets', match: /LOOMAKLIINIK|Loomakliinik/i },
  { category: 'Insurance', match: /IF P&C INSURANCE|ERGO Insurance|Salva Kindlustus|Kindlustus/i },

  // Course platforms, conference fees and the university's own invoices — the
  // Salary rule above already claims TalTech on the income side, so an invoice
  // from the same name can only be something bought.
  {
    category: 'Education',
    match: /UDEMY|INSTICC|COURSERA|ABEBOOKS|Raamatupood|TALLINNA TEHNIKA[ÜY]LIKOOL|TEHNIKA [ÜY]LIKOOLI RAAMA|LUCIDCHART/i
  },
  {
    category: 'Entertainment',
    match:
      /HUMBLEBUNDLE|BLIZZARD|UBISOFT|ORIGIN\.COM|GREENMANGAMING|MACGAMESTORE|FANTASIAPELIT|APOLLO|MUSEI|MUSEUM|MUSEO|ACQUARIO DI|BOOKSHOP ACQUARIO|AHHAA|LOOMAAIA|BOWLINGU|SKYPARK|SIGHTSEEIN|CINAMON|FIENTA/i
  },
  // Clubs and studios billed as a membership or a term's tuition.
  {
    category: 'Hobbies',
    match: /URBAN STYLE|TANTSUSTUUDIO|FREE FLOW STUDIO|SPORDIKLUBI|SURFIKLUBI|POPSPORT|KUNST - HOBI/i
  },

  { category: 'Housing', match: /\bKÜ\b|K\/Ü|Korteriühistu|ELEKTRILEVI|EESTI ENERGIA|Utilitas|Tallinna Vesi|ÜHISTEENUSED|TORU-JURI|hooldustasu/i },
  { category: 'Telecom', match: /STV AS|Telia|Elisa|Tele2|ZONE MEDIA|NORDIC DIGITAL/i },
  {
    category: 'Transport',
    match:
      // Bolt is both the ride and the food delivery; without the lookahead the
      // rides rule swallows every Bolt Food order into Transport.
      /Circle K|Neste|Olerex|Alexela|Statoil|FAVORA|\bBOLT\b(?! ?Food)|TAXI|Linnatransport|Elron|EESTI LIINIRONGID|EUROPARK|CITYPARK|PARKIMISMAJ|VIKING MOTORS|SNCF|REGIE LIGNE|NATIONAL EXPRESS|AIRPORT BUS|AZIENDA MOBILITA|ATAC TAP|MOBILITA'? E TRASPO|\bHSL\b|AUTOBUSI|EMPRESA MALAGUENA DE T|TRANSP INTERMODAIS/i
  },
  {
    category: 'Travel',
    match:
      /AIR ?BALTIC|BOOKING|RYANAIR|Wizz|Hotel|AIRBNB|LUX EXPRESS|SONDER\.COM|VIKING LINE|AEROPORTO|AEROPUERTO|APT FIUMICINO|DUTYFR|TAXFREE|GUEST HOUSE|RESIDENCE|WH SMITH STANSTED/i
  },
  { category: 'Electronics', match: /Arvutitark|Euronics|Klick|On24|Photopoint|OOMIPOOD|MOBILE TRADE|ORDI OÜ|1A\.EE|DATAGATE|HINNAVAATLUS/i },
  { category: 'Home', match: /DEPO|Bauhof|K-Rauta|Ehituse ABC|JYSK|IKEA|Fauni|ESPAK|KESKO SENUKAI|KODUEKSTRA|MASKU|LILLEPOOD|LILLELETT|FLORISTERIA|FIORI PIETRO/i },

  {
    category: 'Groceries',
    match:
      /RIMI|SELVER|PRISMA|MAXIMA|COOP|\bICA\b|LIDL|Grocery|PROMO CASH|A1000MARKET|GROSSI TOIDUKAUBAD|GR\. TK\.|APELSIN|R-KIOSK|KONSUM|MAKSIMARKET|PARLIPOOD|NETOMARKET|SOLARISE TOIDUPOOD|VAANA-JOESUU POOD|CARREFOUR|\bCRF\b|TESCO|SAINSBURY|WAITROSE|\bALDI\b|CONAD|DESPAR|INTERMARCHE|MONOPRIX|SUPERMERCAT|SUPERMERCADO|HIPER CENTER|MARCHE U|PAM LOCAL|CO-OP GROUP FOOD|MINI MARKET/i
  },
  {
    category: 'Restaurants',
    match:
      /Restoran|\bRESTO\b|Kohvik|KOHVISEMU|Cafe|CAFFE|Pizza|Sushi|McDonald|\bMCD\b|Burger|Wolt|Bolt Food|KOCHI AIDAD|FRESHFOOD|CHEFSFOOD|\bKFC\b|VAPIANO|CHOPSTICKS|TANAVATOIT|TOIDUTANAV|SHAURMA|SHAWARMA|KEBAB|KEBABOOM|\bDONER\b|GRILL|PELMEN|O'LEARYS|PAPER MILL|VANA VILLEM|RICOTTA|MAMUSKA|NS KING|PIANO [ÜY]LEMISTE|BUFFET|TAIYAKI|SAMSA|OLDE HANSA|ARNOLDS|SONNE|KANTRIBAAR|TONDI JAZZ|SUVEBAAR|BRIOCHE|FORNO|BAKERY|PAGARID|GELATERIA|GELATINA|HELADERIA|STARBUCKS|ILLY CAFFE|TAPAS|TRATTORIA|CANDY POP|TWISTSNACKS|MRS WAFFLE|MRS BAKERY|CACIO E PEPE|SABATINI|LA FABRICA|DA TONINO|SEE WOO|HONG KONG|BANGKOK|SHIROYA|GEO DONER|BONCHE|TRUMAN|LE FROG|BABYBACK RIBS|NJAMI|ROYAL FOOD/i
  },

  // Clothing, household goods and the general marketplaces. Anything bought
  // rather than consumed, eaten or subscribed to.
  {
    category: 'Shopping',
    match:
      /ALIEXPRESS|ALIPAY|TEMU\.COM|AMZN MKTP|\bEBAY\b|GEARBEST|WISH\.COM|DLB TRADING|kaup24|MAKSEKESKUS|CHILLI DEALS|SAVELITA|H ?& ?M|NEW YORKER|RESERVED|\bHOUSE [ÜY]LEMISTE|HOUSEBRAND|SINSAY|CROPP|TERRANOVA|PEPCO|MINISO|\bTIGER\b|\bNORMAL\b|KAUBAMAJA|STOCKMANN|SPORTSDIRECT|SPORTLAND|EUROSPORT|RADEMAR|\bECCO\b|DENIM DREAM|TWO SIZES|NICE STORE|GOLDTIME|OVERALL EESTI|IDEAAL/i
  },
  {
    category: 'Subscriptions',
    match: /Spotify|Netflix|Google|Apple\.com|Microsoft|Amazon|Patreon|Steam|OPENAI|ANTHROPIC|BUMBLE|GOTINDER|DELFI MEEDIA/i
  }
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

/**
 * Strip diacritics so a rule matches however the bank spelled the name.
 *
 * Card rows arrive transliterated by the terminal — Südameapteek comes through
 * as SUDAMEAPTEEK, Ülemiste as YLEMISTE — while transfer rows keep the real
 * spelling. A rule written either way missed half its rows, which is why a
 * pharmacy chain sat in Uncategorised for a decade.
 *
 * Applied to the patterns as well as the text, so rules stay readable in
 * correct Estonian. Only letters are rewritten, so regex syntax survives.
 */
const fold = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const FOLDED_RULES = CATEGORY_RULES.map((rule) => ({
  ...rule,
  match: new RegExp(fold(rule.match.source), rule.match.flags)
}));

export function categorize(row: StatementRow): string {
  const haystack = fold(`${row.counterparty} ${row.description}`);
  for (const rule of FOLDED_RULES) {
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
