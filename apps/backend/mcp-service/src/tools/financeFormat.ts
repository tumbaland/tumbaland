import { Growth, PeriodTotals, Trade, Transaction } from '../finance';

/** Shared wording for the finance tools: every figure a model reads is formatted here. */

/** Amounts read as money, not as bare numbers a model has to label itself. */
export const money = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Counts get separators too: "7484 matching" is a number to decode, not read. */
export const count = (value: number): string => value.toLocaleString('en-US');

/**
 * A total, to the nearest unit.
 *
 * Cents belong on a payment, where they are what the bank charged, and nowhere
 * near a five-figure aggregate. `510116.00` and `510116` say the same thing and
 * the first one invites the model to quote a precision the figure never had —
 * a net worth built from a daily price job is not accurate to the cent.
 */
export const total = (value: number): string => Math.round(value).toLocaleString('en-US');

/**
 * One trade as a line, by what kind of trade it is.
 *
 * Not by which fields are present: the API sends quantity and price as 0 on a
 * dividend or a fee, so a presence check printed every payout as "0 at 0.00"
 * and hid the amount it paid.
 */
export const describeTrade = (trade: Trade): string => {
  const size =
    trade.type === 'buy' || trade.type === 'sell'
      ? `${trade.quantity ?? 0} at ${money(trade.price ?? 0)}`
      : money(trade.amount ?? 0);
  return `- ${trade.date.slice(0, 10)}: ${trade.type} ${trade.ticker}, ${size}  [id ${trade._id}]`;
};

/** Months as months up to two years, then as years: "3.9 months", "9.8 years". */
export const monthsOf = (months: number): string =>
  months < 24 ? `${months.toFixed(1)} months` : `${(months / 12).toFixed(1)} years`;

/** A percentage with its sign, or nothing when there was no base to compare against. */
export const signed = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/** The same, parenthesised, for trailing a figure it qualifies. */
export const pct = (value: number | null | undefined): string => {
  const rendered = signed(value);
  return rendered ? ` (${rendered})` : '';
};

/** A change, with its direction said in words rather than left to a minus sign. */
export const moved = (value: number, percentage?: number | null): string =>
  `${value >= 0 ? 'up' : 'down'} ${total(Math.abs(value))}${pct(percentage)}`;

/**
 * One period, as a sentence.
 *
 * Income, spending and the split inside the spending: money consumed against
 * money moved into an asset. Keeping those apart is the whole point of the
 * period totals — spending 65,688 of which 39,021 went into investments is not
 * the same story as spending 65,688, and a model given only the total tells the
 * wrong one.
 */
export const describePeriod = (period: PeriodTotals): string => {
  const window = period.from && period.to ? `${period.from} to ${period.to}` : 'the period';
  const rate = period.savingsRate === null || period.savingsRate === undefined
    ? ''
    : ` (${period.savingsRate.toFixed(0)}% of income)`;
  // Salary against what the money itself paid: the part that carries on when
  // the salary stops is the one worth knowing.
  const by = period.incomeBy;
  const sources = by
    ? ` (salary ${total(by.salary)}, from assets ${total(by.dividends + by.interest)}` +
      `${by.other > 0.5 ? `, other ${total(by.other)}` : ''})`
    : '';
  return (
    `${window}: income ${total(period.income)}${sources}, out ${total(period.expense)} — ` +
    `${total(period.consumption)} consumed, ${total(period.invested)} into assets. ` +
    `Saved ${total(period.savings)}${rate}.`
  );
};

/**
 * Why net worth moved, when the split is trustworthy.
 *
 * An incomplete split is left out rather than shown with a caveat: the numbers
 * do not add up in that case, and a model handed two figures that disagree with
 * their own total will reconcile them by inventing a reason.
 */
export const describeGrowth = (growth: Growth | null | undefined): string | null => {
  if (!growth || growth.complete === false) return null;
  const window = growth.from && growth.to ? ` between ${growth.from} and ${growth.to}` : '';
  return (
    `Net worth moved ${total(growth.netWorthChange)}${window}: ` +
    `${total(growth.marketGrowth)} from the market, ${total(growth.contributions)} from contributions.`
  );
};

export const describeTransaction = (transaction: Transaction): string => {
  const day = transaction.date.slice(0, 10);
  const sign = transaction.type === 'income' ? '+' : '−';
  const detail = transaction.note ? ` — ${transaction.note}` : '';
  return `- ${day}: ${sign}${money(Math.abs(transaction.amount))} ${transaction.category}${detail}  [id ${transaction._id}]`;
};
