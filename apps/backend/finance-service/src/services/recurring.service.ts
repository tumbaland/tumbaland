import Transaction, { ITransaction } from '../models/Transaction';
import { scopeFor } from '../utils/scope';
import { fold } from './bankStatement.service';

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PriceChange {
  /** what it used to cost — the median of the charges before the latest one */
  previousAmount: number;
  currentAmount: number;
  /** the charge that came in at the new price (YYYY-MM-DD) */
  changedOn: string;
}

export interface RecurringPayment {
  /** stable across refreshes: the normalised merchant it was grouped on */
  key: string;
  /** the merchant as the statement spells it, for display */
  merchant: string;
  category: string;
  cadence: Cadence;
  /** median days between charges */
  intervalDays: number;
  occurrences: number;
  /** share of the gaps that fit the cadence, 0–1 */
  regularity: number;
  /** median charge — a median, so one annual surcharge cannot set the figure */
  amount: number;
  /** (max − min) / median: how much the charge moves around */
  amountVariation: number;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
  firstCharge: string;
  lastCharge: string;
  /** lastCharge + one interval (YYYY-MM-DD) */
  nextExpected: string;
  /** negative once the expected date has passed */
  daysUntilNext: number;
  status: 'active' | 'due' | 'lapsed';
  priceChange: PriceChange | null;
}

export interface RecurringReport {
  /** the window analysed (YYYY-MM-DD) */
  from: string;
  to: string;
  /** what the still-running subscriptions cost per month, and per year */
  monthlyTotal: number;
  yearlyTotal: number;
  /** how many of `payments` have stopped arriving */
  lapsedCount: number;
  /** most expensive per month first */
  payments: RecurringPayment[];
}

export interface RecurringOptions {
  groupId?: string;
  /** how far back to look for a pattern */
  months?: number;
  now?: Date;
}

/** Two years is enough to see an annual renewal twice, which is what proves one. */
export const DEFAULT_MONTHS = 24;

/** A pattern needs three charges: two points only ever make one gap. */
const MIN_OCCURRENCES = 3;

/** Below this, the gaps are too scattered to call the charge a subscription. */
const MIN_REGULARITY = 0.6;

/** A charge this far off the earlier ones reads as a price change, not noise. */
const PRICE_CHANGE_THRESHOLD = 0.05;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;

/**
 * The cadences worth naming, each with the band of gaps that still counts as
 * that cadence. The bands are wide on purpose: a monthly subscription billed on
 * the 1st lands 28 to 31 days apart, and a card that retries a failed charge
 * can push one a week late without the subscription having changed.
 */
const CADENCES: { name: Cadence; min: number; max: number }[] = [
  { name: 'weekly', min: 5, max: 9 },
  { name: 'biweekly', min: 10, max: 18 },
  { name: 'monthly', min: 24, max: 38 },
  { name: 'quarterly', min: 75, max: 105 },
  { name: 'yearly', min: 320, max: 400 }
];

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The middle value — the average would let one odd charge move every figure. */
export const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/**
 * The merchant a note is about, normalised so the same shop groups together.
 *
 * Imported rows read "COUNTERPARTY · description": the counterparty is the
 * stable half, while the description carries invoice numbers, dates and card
 * references that differ on every single charge. Taking the half before the
 * separator, then dropping digits and punctuation, is what turns twelve
 * one-off-looking rows into one subscription.
 */
export const merchantKey = (note?: string): string | null => {
  if (!note) return null;

  const [counterparty] = note.split('·');
  const normalized = fold(counterparty)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Two characters is not a merchant, it is a leftover from stripping the rest.
  return normalized.length >= 3 ? normalized.slice(0, 60) : null;
};

/** The merchant as written, for display — the separator and references removed. */
const merchantLabel = (note: string): string => note.split('·')[0].trim().slice(0, 60);

/** The gaps, in whole days, between consecutive charges. */
const gapsBetween = (dates: Date[]): number[] =>
  dates.slice(1).map((date, index) => Math.round((date.getTime() - dates[index].getTime()) / MS_PER_DAY));

/** The most common value, ties broken by first appearance. */
const mostCommon = (values: string[]): string => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
};

/**
 * Did the price move? Compares the latest charge against the median of the ones
 * before it, so a single new amount is reported the first time it appears
 * rather than after it has been paid often enough to shift an average.
 */
const detectPriceChange = (amounts: number[], dates: Date[]): PriceChange | null => {
  const currentAmount = amounts[amounts.length - 1];
  const earlier = amounts.slice(0, -1);
  const previousAmount = median(earlier);

  if (previousAmount <= 0) return null;
  if (Math.abs(currentAmount - previousAmount) / previousAmount < PRICE_CHANGE_THRESHOLD) return null;

  return {
    previousAmount: round2(previousAmount),
    currentAmount: round2(currentAmount),
    changedOn: dayKey(dates[dates.length - 1])
  };
};

/**
 * One merchant's charges, judged as a subscription or not.
 *
 * Returns null when the charges are too few, too scattered, or spaced at
 * something no billing cycle uses — a shop visited whenever, rather than a
 * subscription. Being strict here is the point: a list padded with the weekly
 * supermarket run is one nobody reads.
 */
const toRecurringPayment = (
  key: string,
  charges: ITransaction[],
  today: number
): RecurringPayment | null => {
  if (charges.length < MIN_OCCURRENCES) return null;

  const dates = charges.map((charge) => new Date(charge.date));
  const gaps = gapsBetween(dates);
  const intervalDays = Math.round(median(gaps));
  const cadence = CADENCES.find((entry) => intervalDays >= entry.min && intervalDays <= entry.max);
  if (!cadence) return null;

  // Judged against the cadence's own band rather than a percentage of the
  // median, so "monthly" tolerates the length of February without also
  // tolerating a six-week gap in a weekly charge.
  const onCadence = gaps.filter((gap) => gap >= cadence.min && gap <= cadence.max).length;
  const regularity = onCadence / gaps.length;
  if (regularity < MIN_REGULARITY) return null;

  const amounts = charges.map((charge) => charge.amount);
  const amount = median(amounts);
  const lastDate = dates[dates.length - 1];
  const lastDay = Math.floor(lastDate.getTime() / MS_PER_DAY);
  const daysSinceLast = today - lastDay;
  const daysUntilNext = intervalDays - daysSinceLast;

  return {
    key,
    merchant: merchantLabel(mostCommon(charges.map((charge) => charge.note ?? ''))),
    category: mostCommon(charges.map((charge) => charge.category)),
    cadence: cadence.name,
    intervalDays,
    occurrences: charges.length,
    regularity: round2(regularity),
    amount: round2(amount),
    amountVariation: amount > 0 ? round2((Math.max(...amounts) - Math.min(...amounts)) / amount) : 0,
    monthlyEquivalent: round2((amount * DAYS_PER_MONTH) / intervalDays),
    yearlyEquivalent: round2((amount * 365.25) / intervalDays),
    firstCharge: dayKey(dates[0]),
    lastCharge: dayKey(lastDate),
    nextExpected: dayKey(new Date((lastDay + intervalDays) * MS_PER_DAY)),
    daysUntilNext,
    // Half a cycle past due is still just a late charge; well past the widest
    // gap the cadence allows, the subscription has almost certainly ended.
    status: daysUntilNext >= 0 ? 'active' : daysSinceLast > cadence.max * 1.5 ? 'lapsed' : 'due',
    priceChange: detectPriceChange(amounts, dates)
  };
};

/**
 * The subscriptions hiding in a statement: charges from the same merchant
 * arriving on a regular cycle.
 *
 * Nothing here is declared by the owner — it is all inferred from imported
 * rows, which is the only way it could work when entries arrive by the
 * thousand from a bank export. Expenses only: a salary is regular too, but it
 * is not something anyone is looking to cancel.
 */
export const getRecurringPayments = async (
  userId: string,
  options: RecurringOptions = {}
): Promise<RecurringReport> => {
  const { groupId, months = DEFAULT_MONTHS, now = new Date() } = options;

  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  const today = Math.floor(to.getTime() / MS_PER_DAY);

  const charges = await Transaction.find({
    ...scopeFor(userId, groupId),
    type: 'expense',
    date: { $gte: from }
  }).sort({ date: 1 });

  const byMerchant = new Map<string, ITransaction[]>();
  for (const charge of charges) {
    const key = merchantKey(charge.note);
    if (!key) continue;
    const group = byMerchant.get(key);
    if (group) group.push(charge);
    else byMerchant.set(key, [charge]);
  }

  const payments: RecurringPayment[] = [];
  for (const [key, group] of byMerchant) {
    const payment = toRecurringPayment(key, group, today);
    if (payment) payments.push(payment);
  }

  payments.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

  // A lapsed subscription is listed — knowing it stopped is useful — but it is
  // no longer being paid, so it must not inflate what the running ones cost.
  const running = payments.filter((payment) => payment.status !== 'lapsed');

  return {
    from: dayKey(from),
    to: dayKey(to),
    monthlyTotal: round2(running.reduce((sum, payment) => sum + payment.monthlyEquivalent, 0)),
    yearlyTotal: round2(running.reduce((sum, payment) => sum + payment.yearlyEquivalent, 0)),
    lapsedCount: payments.length - running.length,
    payments
  };
};
