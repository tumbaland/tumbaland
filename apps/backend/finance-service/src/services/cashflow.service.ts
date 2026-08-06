import Transaction from '../models/Transaction';
import Budget from '../models/Budget';
import Snapshot, { ISnapshot } from '../models/Snapshot';
import AssetClass from '../models/AssetClass';
import { scopeFor } from '../utils/scope';

export interface MonthSummary {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  /** income − expense: what was actually put aside that month. */
  savings: number;
  /** Savings as a share of income. Null when nothing came in to save from. */
  savingsRate: number | null;
}

export interface CategorySummary {
  category: string;
  spent: number;
  budget: number | null;
  /** spent − budget: positive means over. Null without a budget to compare to. */
  variance: number | null;
}

/**
 * Why net worth moved: the part explained by money put aside, and the part left
 * over, which is market movement (and anything not captured as a transaction).
 */
export interface GrowthBreakdown {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
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

export interface CashflowSummary {
  months: MonthSummary[];
  categories: CategorySummary[];
  /** Rolled up over the whole requested window. */
  totals: MonthSummary;
  growth: GrowthBreakdown | null;
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** First of the month, UTC, `monthsBack` months before `from`. */
function shiftMonths(from: Date, monthsBack: number): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsBack, 1));
}

function summarize(month: string, income: number, expense: number): MonthSummary {
  return {
    month,
    income,
    expense,
    savings: income - expense,
    // A rate against zero income is not 0% or 100%, it is undefined.
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : null
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

  const [transactions, budgets] = await Promise.all([
    Transaction.find({ ...scope, date: { $gte: from } }).sort({ date: 1 }),
    Budget.find(scope)
  ]);

  const byMonth = new Map<string, { income: number; expense: number }>();
  const byCategory = new Map<string, number>();
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const bucket = byMonth.get(key) || { income: 0, expense: 0 };

    if (transaction.type === 'income') {
      bucket.income += transaction.amount;
      income += transaction.amount;
    } else {
      bucket.expense += transaction.amount;
      expense += transaction.amount;
      byCategory.set(transaction.category, (byCategory.get(transaction.category) || 0) + transaction.amount);
    }

    byMonth.set(key, bucket);
  }

  const monthSummaries = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income: monthIncome, expense: monthExpense }]) =>
      summarize(month, monthIncome, monthExpense)
    );

  // Spend is compared against a monthly budget, so an average over the months
  // that actually have data — not the whole window — is the like-for-like figure.
  const activeMonths = Math.max(1, monthSummaries.length);
  const budgetByCategory = new Map(budgets.map((b) => [b.category, b.amount]));
  const categoryNames = new Set([...byCategory.keys(), ...budgetByCategory.keys()]);

  const categories: CategorySummary[] = [...categoryNames]
    .map((category) => {
      const spent = (byCategory.get(category) || 0) / activeMonths;
      const budget = budgetByCategory.get(category) ?? null;
      return {
        category,
        spent,
        budget,
        variance: budget === null ? null : spent - budget
      };
    })
    .sort((a, b) => b.spent - a.spent);

  const growth = await getGrowthBreakdown(userId, options.groupId, monthSummaries);

  return {
    months: monthSummaries,
    categories,
    totals: summarize('all', income, expense),
    growth
  };
};

/**
 * Split the net-worth change between the two most recent check-ins into money
 * saved and market movement.
 *
 * Uses consecutive snapshots rather than a fixed window because the whole point
 * is to explain a movement the user just saw on the dashboard.
 */
export const getGrowthBreakdown = async (
  userId: string,
  groupId: string | undefined,
  monthSummaries: MonthSummary[]
): Promise<GrowthBreakdown | null> => {
  const scope = scopeFor(userId, groupId);
  const snapshots = await Snapshot.find(scope).sort({ date: -1 }).limit(2);
  if (snapshots.length < 2) return null;

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

  // The check-in is dated the first of the month and reports the position at
  // that point, so the money that moved it is the previous month's cash flow.
  const contributionMonth = monthKey(previous.date);
  const summary = monthSummaries.find((m) => m.month === contributionMonth);
  const netWorthChange = netOf(latest) - netOf(previous);
  const contributions = summary?.savings ?? 0;

  return {
    from: monthKey(previous.date),
    to: monthKey(latest.date),
    netWorthChange,
    contributions,
    marketGrowth: netWorthChange - contributions,
    complete: summary !== undefined
  };
};
