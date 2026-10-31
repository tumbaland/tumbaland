import Transaction from '../models/Transaction';
import Snapshot, { ISnapshot } from '../models/Snapshot';
import AssetClass from '../models/AssetClass';
import { scopeFor } from '../utils/scope';
import { INVESTMENT_CATEGORIES, NON_EARNING_CATEGORIES } from './bankStatement.service';

export interface MonthSummary {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  /**
   * What was actually kept: earned income less what was consumed. Money moved
   * into an asset counts as kept, not as spent, and an asset sold or a deposit
   * maturing is not earnings — the same definition the analytics use, so a
   * month of buying funds does not read as a month of losing money.
   */
  savings: number;
  /** Savings as a share of earned income. Null when nothing was earned to save from. */
  savingsRate: number | null;
}

export interface CategorySummary {
  category: string;
  /** Monthly average across the months that have transactions. */
  spent: number;
}

/**
 * Why net worth moved: the part explained by money put aside, and the part left
 * over, which is market movement (and anything not captured as a transaction).
 *
 * "Put aside" is earned income less consumption. Buying a fund moves cash into
 * an asset and changes net worth by nothing, so it is neither spending nor a
 * contribution; counting it as spending made every purchase read as a loss of
 * savings and handed the same amount to "market growth".
 */
export interface GrowthBreakdown {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  /** Months the span covers, so a short history can be labelled as one. */
  months: number;
  netWorthChange: number;
  contributions: number;
  /** netWorthChange − contributions. */
  marketGrowth: number;
  /**
   * False when the period is not fully covered by transactions, in which case
   * the split is a lower bound on contributions and the remainder is not purely
   * market movement. Reporting it as certain would flatter or damn returns.
   */
  complete: boolean;
}

export interface GrowthBreakdowns {
  /** The last pair of check-ins — why net worth moved this month. */
  monthly: GrowthBreakdown | null;
  /**
   * The same split over roughly the last year of check-ins, which is the scope
   * the headline cash-flow figures are on. A single month of market movement is
   * noise; a year of it is a return.
   */
  trailing: GrowthBreakdown | null;
}

export interface CashflowSummary {
  months: MonthSummary[];
  categories: CategorySummary[];
  /** Rolled up over the whole requested window. */
  totals: MonthSummary;
  growth: GrowthBreakdown | null;
  /** The same split over the trailing year — the default view on the page. */
  growthTrailing: GrowthBreakdown | null;
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** First of the month, UTC, `monthsBack` months before `from`. */
function shiftMonths(from: Date, monthsBack: number): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsBack, 1));
}

/** Whole months from `from` to `to`, which is what a span of check-ins covers. */
function monthsApart(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  );
}

/** Every month key in [from, to) — the months whose cash flow moved the position. */
function monthsBetween(from: Date, to: Date): string[] {
  const span = monthsApart(from, to);
  return Array.from({ length: span }, (_, i) => monthKey(shiftMonths(to, span - i)));
}

/** Earned income and consumption: what is left once money moving into or out of assets is set aside. */
interface Flows {
  income: number;
  expense: number;
  earned: number;
  consumed: number;
}

const flowOf = (type: string, category: string, amount: number): Flows => ({
  income: type === 'income' ? amount : 0,
  expense: type === 'income' ? 0 : amount,
  earned: type === 'income' && !NON_EARNING_CATEGORIES.has(category) ? amount : 0,
  consumed: type !== 'income' && !INVESTMENT_CATEGORIES.has(category) ? amount : 0
});

function summarize(month: string, { income, expense, earned, consumed }: Flows): MonthSummary {
  return {
    month,
    income,
    expense,
    savings: earned - consumed,
    // A rate against zero income is not 0% or 100%, it is undefined.
    savingsRate: earned > 0 ? ((earned - consumed) / earned) * 100 : null
  };
}

export interface CashflowOptions {
  /** How many months back from today to cover. */
  months?: number;
  groupId?: string;
}

export const DEFAULT_MONTHS = 12;

export const getCashflowSummary = async (
  userId: string,
  options: CashflowOptions = {}
): Promise<CashflowSummary> => {
  const months = options.months ?? DEFAULT_MONTHS;
  const scope = scopeFor(userId, options.groupId);
  const now = new Date();
  const from = shiftMonths(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), months - 1);

  const transactions = await Transaction.find({ ...scope, date: { $gte: from } }).sort({ date: 1 });

  const empty = (): Flows => ({ income: 0, expense: 0, earned: 0, consumed: 0 });
  const add = (into: Flows, from: Flows) => {
    into.income += from.income;
    into.expense += from.expense;
    into.earned += from.earned;
    into.consumed += from.consumed;
  };

  const byMonth = new Map<string, Flows>();
  const byCategory = new Map<string, number>();
  const all = empty();

  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const flow = flowOf(transaction.type, transaction.category, transaction.amount);
    const bucket = byMonth.get(key) || empty();

    add(bucket, flow);
    add(all, flow);
    byMonth.set(key, bucket);

    if (transaction.type !== 'income') {
      byCategory.set(transaction.category, (byCategory.get(transaction.category) || 0) + transaction.amount);
    }
  }

  const monthSummaries = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, flows]) => summarize(month, flows));

  // A monthly average over the months that actually have data — not the whole
  // window — is what makes categories comparable across periods.
  const activeMonths = Math.max(1, monthSummaries.length);

  const categories: CategorySummary[] = [...byCategory.entries()]
    .map(([category, total]) => ({ category, spent: total / activeMonths }))
    .sort((a, b) => b.spent - a.spent);

  const growth = await getGrowthBreakdown(userId, options.groupId, monthSummaries);

  return {
    months: monthSummaries,
    categories,
    totals: summarize('all', all),
    growth: growth.monthly,
    growthTrailing: growth.trailing
  };
};

/** How many months back the trailing net-worth split reaches for its opening check-in. */
export const TRAILING_MONTHS = 12;

/**
 * Money put aside, month by month, over [from, to).
 *
 * Read from the transactions directly rather than from the summary window: that
 * window counts back from today, but the check-ins this is matched against can
 * end on a different month — finance data often runs a month ahead — and any
 * month the window missed would silently count as nothing saved.
 */
const savingsByMonth = async (
  scope: Record<string, unknown>,
  from: Date,
  to: Date
): Promise<Map<string, number>> => {
  const isIncome = { $eq: ['$type', 'income'] };
  // Months are grouped from every row, so a month with nothing but money moved
  // into assets still counts as covered; only what is earned and consumed is summed.
  const rows: Array<{ _id: string; earned: number; consumed: number }> = await Transaction.aggregate([
    { $match: { ...scope, date: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
        earned: {
          $sum: {
            $cond: [{ $and: [isIncome, { $not: [{ $in: ['$category', [...NON_EARNING_CATEGORIES]] }] }] }, '$amount', 0]
          }
        },
        consumed: {
          $sum: {
            $cond: [{ $and: [{ $not: [isIncome] }, { $not: [{ $in: ['$category', [...INVESTMENT_CATEGORIES]] }] }] }, '$amount', 0]
          }
        }
      }
    }
  ]);

  return new Map(rows.map((row) => [row._id, row.earned - row.consumed]));
};

/**
 * Split a net-worth change into money put aside and market movement, over two
 * spans: the last pair of check-ins, and roughly the last year of them.
 *
 * The pair explains a movement the user just saw on the dashboard. The year is
 * the scope everything else on the page is on, and the one worth judging: a
 * month of market movement is noise, and a month of contributions is whatever
 * the salary date happened to land on.
 */
export const getGrowthBreakdown = async (
  userId: string,
  groupId: string | undefined,
  monthSummaries: MonthSummary[]
): Promise<GrowthBreakdowns> => {
  const scope = scopeFor(userId, groupId);
  // Enough check-ins to reach a year back even with a month or two missing.
  const snapshots = await Snapshot.find(scope)
    .sort({ date: -1 })
    .limit(TRAILING_MONTHS + 2);
  if (snapshots.length < 2) return { monthly: null, trailing: null };

  const [latest, previous] = snapshots;
  const assetClasses = await AssetClass.find(scope);
  const liabilityIds = new Set(
    assetClasses.filter((ac) => ac.kind === 'liability').map((ac) => String(ac._id))
  );

  const netOf = (snapshot: ISnapshot) =>
    snapshot.entries.reduce(
      (sum, e) => sum + (liabilityIds.has(e.assetClassId) ? -e.value : e.value),
      0
    );

  const split = (
    opening: ISnapshot,
    contributions: number,
    complete: boolean
  ): GrowthBreakdown => {
    const netWorthChange = netOf(latest) - netOf(opening);
    return {
      from: monthKey(opening.date),
      to: monthKey(latest.date),
      months: monthsApart(opening.date, latest.date),
      netWorthChange,
      contributions,
      marketGrowth: netWorthChange - contributions,
      complete
    };
  };

  // The check-in is dated the first of the month and reports the position at
  // that point, so the money that moved it is the previous month's cash flow.
  const contributionMonth = monthKey(previous.date);
  const summary = monthSummaries.find((m) => m.month === contributionMonth);
  const monthly = split(previous, summary?.savings ?? 0, summary !== undefined);

  // The check-in nearest a year before the latest, rather than one exactly
  // twelve months back: a missed month would otherwise drop the whole view.
  const target = shiftMonths(latest.date, TRAILING_MONTHS);
  const opening = snapshots
    .slice(1)
    .reduce((best, s) =>
      Math.abs(s.date.getTime() - target.getTime()) < Math.abs(best.date.getTime() - target.getTime())
        ? s
        : best
    );

  const months = monthsBetween(opening.date, latest.date);
  const saved = await savingsByMonth(scope, opening.date, latest.date);

  return {
    monthly,
    trailing: split(
      opening,
      months.reduce((sum, month) => sum + (saved.get(month) ?? 0), 0),
      months.every((month) => saved.has(month))
    )
  };
};
