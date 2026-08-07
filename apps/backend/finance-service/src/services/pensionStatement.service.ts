import { parseCsv, parseStatementDate } from './bankStatement.service';

/**
 * Reader for Pensionikeskus account statements.
 *
 * Pensionikeskus is the central Estonian pension registry, so one export
 * carries every pillar and every fund manager — which is why it is the format
 * this app reads rather than any single bank's. Get it from
 * https://public.pensionikeskus.ee → Kontoväljavõte.
 *
 * Format:
 *   - comma separated, CRLF, twelve columns with an Estonian header row
 *   - ISO-8859-1, *not* UTF-8 — see decodeStatement
 *   - "Sammas" states the pillar outright (STEP_2 / STEP_3), so nothing has to
 *     be guessed from a fund name
 *   - dates are DD.MM.YYYY
 *
 * Each contribution appears three times: the money landing on the pillar's cash
 * account, the same money leaving it for the fund, and the units bought. Only
 * the last is read — the other two are the same euros in transit, and counting
 * them would treble every contribution.
 */

/** The unit purchase. Every other row type is the money on its way there. */
const SUBSCRIPTION = 'Osakute märkimine';

const COLUMNS = {
  fund: 'Väärtpaberi/ raha konto nimi',
  pillar: 'Sammas',
  date: 'Kande kuupäev',
  type: 'Kande liik',
  currency: 'Valuuta',
  price: 'Hind',
  quantity: 'Kogus/ Summa'
} as const;

export type Pillar = 'II' | 'III';

const PILLAR_BY_CODE: Record<string, Pillar> = { STEP_2: 'II', STEP_3: 'III' };

export interface PensionContribution {
  date: Date;
  /** Euros, from price × units — the file states neither directly. */
  amount: number;
  units: number;
  price: number;
  fund: string;
  pillar: Pillar;
}

export interface PensionStatement {
  contributions: PensionContribution[];
  /** Rows deliberately passed over, by reason, so nothing vanishes silently. */
  skipped: Record<string, number>;
  funds: string[];
  pillars: Pillar[];
}

/**
 * Decode a statement whatever encoding it arrived in.
 *
 * Pensionikeskus emits ISO-8859-1 while every other file this app reads is
 * UTF-8. Decoding the wrong one turns "Osakute märkimine" into mojibake, and
 * since that string is what selects the rows, the import silently finds
 * nothing at all. UTF-8 is tried strictly first: a file that is valid UTF-8 is
 * always meant as UTF-8, and one that is not is Latin-1 in practice.
 */
export function decodeStatement(body: Buffer | string): string {
  if (typeof body === 'string') return body;
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(body);
  return utf8.includes('�') ? body.toString('latin1') : utf8;
}

/** "1 234.56" / "-607.00" → number. The export uses a plain decimal point. */
function parseNumber(value: string): number {
  const parsed = parseFloat(String(value).replace(/\s/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** True when the text looks like a Pensionikeskus statement. */
export function isPensionStatement(text: string): boolean {
  const [header] = parseCsv(text.replace(/^\uFEFF/, ''), ',');
  if (!header) return false;
  const columns = header.map((h) => h.trim());
  return columns.includes(COLUMNS.pillar) && columns.includes(COLUMNS.type);
}

export function readPensionStatement(text: string): PensionStatement {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ''), ',');
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  if (!header) return { contributions: [], skipped, funds: [], pillars: [] };

  const columns = header.map((h) => h.trim());
  const index = (name: string) => columns.indexOf(name);
  const at = (cells: string[], name: string) => (cells[index(name)] || '').trim();

  const contributions: PensionContribution[] = [];
  for (const cells of body) {
    const type = at(cells, COLUMNS.type);

    // The header repeats when a statement is pasted together page by page.
    if (type === COLUMNS.type || type === '') { skip('header or blank row'); continue; }
    if (type !== SUBSCRIPTION) { skip(`${type} (money on its way to the fund)`); continue; }

    const pillar = PILLAR_BY_CODE[at(cells, COLUMNS.pillar)];
    if (!pillar) { skip(`unknown pillar "${at(cells, COLUMNS.pillar)}"`); continue; }

    const currency = at(cells, COLUMNS.currency);
    if (currency && currency !== 'EUR') { skip(`currency ${currency}`); continue; }

    const date = parseStatementDate(at(cells, COLUMNS.date));
    const price = parseNumber(at(cells, COLUMNS.price));
    const units = parseNumber(at(cells, COLUMNS.quantity));

    if (!date || !Number.isFinite(price) || !Number.isFinite(units) || price <= 0 || units <= 0) {
      skip('unusable row (date, price or units)');
      continue;
    }

    contributions.push({
      date,
      // Rounded to the cent: price carries five decimals, so the product
      // arrives as 606.9999999 rather than the 607.00 that was paid.
      amount: Math.round(price * units * 100) / 100,
      units,
      price,
      fund: at(cells, COLUMNS.fund),
      pillar
    });
  }

  contributions.sort((a, b) => +a.date - +b.date);

  return {
    contributions,
    skipped,
    funds: [...new Set(contributions.map((c) => c.fund))].sort(),
    pillars: [...new Set(contributions.map((c) => c.pillar))].sort()
  };
}
