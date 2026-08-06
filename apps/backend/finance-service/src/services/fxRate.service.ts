import { logger } from '@tumbaland/backend-core';
import FxRate from '../models/FxRate';
import { fetchExchangeRate } from './alphaVantage.service';

/**
 * The currency every aggregate total is expressed in. Instrument prices arrive
 * from the provider in the instrument's own currency, so without converting to
 * a single base a portfolio holding both a US and a European ETF sums dollars
 * and euros into one meaningless number.
 */
export const BASE_CURRENCY = 'EUR';

function toUtcDateOnly(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10));
}

/**
 * Latest known rate for a pair, at or before `on` (default: today).
 * Returns null when the pair has never been fetched.
 */
export async function getRate(base: string, quote: string, on?: Date): Promise<number | null> {
  if (base === quote) return 1;

  const record = await FxRate.findOne({
    base: base.toUpperCase(),
    quote: quote.toUpperCase(),
    ...(on ? { date: { $lte: toUtcDateOnly(on) } } : {})
  }).sort({ date: -1 });

  return record?.rate ?? null;
}

/**
 * Rates for several currencies into `quote`, as one map. Missing pairs are
 * simply absent from the map — callers decide whether to skip the value or
 * surface it unconverted, rather than being handed a silently wrong 1.0.
 */
export async function getRates(bases: string[], quote: string): Promise<Map<string, number>> {
  const target = quote.toUpperCase();
  const wanted = [...new Set(bases.map((c) => c.toUpperCase()))];
  const rates = new Map<string, number>();

  const needsLookup: string[] = [];
  for (const base of wanted) {
    if (base === target) rates.set(base, 1);
    else needsLookup.push(base);
  }
  if (needsLookup.length === 0) return rates;

  // One document per pair: the newest, which `date: -1` in the index provides.
  const records = await FxRate.find({ base: { $in: needsLookup }, quote: target }).sort({ date: -1 });
  for (const record of records) {
    if (!rates.has(record.base)) rates.set(record.base, record.rate);
  }

  return rates;
}

/**
 * Fetch today's rate for a pair and store it. Returns the rate, or null when
 * the provider had nothing (quota, throttle, unknown pair) — in which case the
 * previously stored rate stays the most recent one `getRate` will return.
 */
export async function refreshRate(base: string, quote: string): Promise<number | null> {
  const from = base.toUpperCase();
  const to = quote.toUpperCase();
  if (from === to) return 1;

  const rate = await fetchExchangeRate(from, to);
  if (rate === null) return null;

  const date = toUtcDateOnly(new Date());
  await FxRate.findOneAndUpdate(
    { base: from, quote: to, date },
    { base: from, quote: to, date, rate },
    { upsert: true, new: true }
  );

  logger.info('FX rate updated', { base: from, quote: to, rate });
  return rate;
}
