import Transaction from '../models/Transaction';
import { scopeFor } from '../utils/scope';
import { INVESTMENT_CATEGORIES } from './bankStatement.service';

export interface PeriodTotals {
  income: number;
  /** Everything that left the account, consumption and investing alike. */
  expense: number;
  /** What was actually consumed — `expense` less money moved into assets. */
  consumption: number;
  /** Money moved into crypto, a broker or a savings product. */
  invested: number;
  /** income − consumption: investing counts as kept, not spent. */
  savings: number;
  savingsRate: number | null;
  /** Months the window covers, so a partial period can be labelled as one. */
  months: number;
  from: string;
  to: string;
}

export interface YearSummary extends PeriodTotals {
  year: number;
  /** Change against the previous year, null for the first year on record. */
  incomeChange: number | null;
  incomeChangePct: number | null;
  expenseChange: number | null;
  expenseChangePct: number | null;
  /**
   * True when the year has fewer than twelve months of data. Comparing a
   * part-year total against a full one reads as a collapse in spending when
   * nothing has changed, so the UI has to be able to say which is which.
   */
  partial: boolean;
}

export interface CategoryTrend {
  category: string;
  /** Spend per calendar year, for the stacked chart. */
  byYear: Record<number, number>;
  /** Everything ever recorded in this category. */
  total: number;
  /** Spend over the trailing window. */
  latest: number;
  /** Spend over the window before it — the like-for-like comparison. */
  previous: number;
  change: number;
  changePct: number | null;
  /** `latest` divided by the window length, which is what a budget compares to. */
  perMonth: number;
}

export interface IncomeSource {
  category: string;
  total: number;
  byYear: Record<number, number>;
}

export interface PeriodPoint {
  /** YYYY for a year, YYYY-MM for a month. */
  period: string;
  income: number;
  expense: number;
  savings: number;
}

export interface Analytics {
  years: YearSummary[];
  months: PeriodPoint[];
  /**
   * The last twelve months of data and the twelve before them. Calendar years
   * are the wrong comparison for most of the year — in March, "this year" is
   * two months against twelve — so every headline figure and every category
   * comparison uses these instead.
   */
  trailing: { current: PeriodTotals; previous: PeriodTotals | null };
  categoryTrends: CategoryTrend[];
  incomeSources: IncomeSource[];
  /** Category names treated as investing rather than spending. */
  investmentCategories: string[];
  currency: string;
}

/** How many months the trailing comparison covers. */
export const TRAILING_MONTHS = 12;

/** Longest month series worth returning — see buildMonthSeries. */
const MAX_MONTH_POINTS = 600;

const pct = (change: number, base: number): number | null =>
  base > 0 ? (change / base) * 100 : null;

interface MonthCategoryRow {
  _id: { year: number; month: number; category: string; type: 'income' | 'expense' };
  total: number;
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Every month key between two, inclusive, so a gap does not become a chart artefact. */
function monthRange(first: string, last: string): string[] {
  const [fy, fm] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);

  const end = new Date(Date.UTC(ly, lm - 1, 1));
  let start = new Date(Date.UTC(fy, fm - 1, 1));
  if (Number.isNaN(+start) || Number.isNaN(+end) || start > end) return [];

  // A single corrupt date decades out would otherwise zero-fill the whole gap.
  // Clamping the *start* forward keeps the recent end — the part anyone looks
  // at — where clamping the loop would have kept the ancient beginning instead.
  const span = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  if (span > MAX_MONTH_POINTS) {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (MAX_MONTH_POINTS - 1), 1));
  }

  const keys: string[] = [];
  const cursor = start;
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

interface Bucket {
  income: number;
  expense: number;
  invested: number;
}

const emptyBucket = (): Bucket => ({ income: 0, expense: 0, invested: 0 });

function summarize(bucket: Bucket, months: number, from: string, to: string): PeriodTotals {
  const consumption = bucket.expense - bucket.invested;
  return {
    income: bucket.income,
    expense: bucket.expense,
    consumption,
    invested: bucket.invested,
    savings: bucket.income - consumption,
    // A rate against no income is undefined, not zero.
    savingsRate: bucket.income > 0 ? ((bucket.income - consumption) / bucket.income) * 100 : null,
    months,
    from,
    to
  };
}

/**
 * Long-run view of the cash-flow history: how income and spending have moved,
 * which categories are driving the change, and where the income came from.
 *
 * One aggregation supplies all of it. The history runs to thousands of rows and
 * only the monthly per-category totals are needed; everything else is a fold
 * over that, which keeps the comparisons consistent with each other.
 */
export const getAnalytics = async (userId: string, groupId?: string): Promise<Analytics> => {
  const scope = scopeFor(userId, groupId);

  const rows: MonthCategoryRow[] = await Transaction.aggregate([
    { $match: scope },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          category: '$category',
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    }
  ]);

  const base = {
    years: [] as YearSummary[],
    months: [] as PeriodPoint[],
    trailing: { current: summarize(emptyBucket(), 0, '', ''), previous: null },
    categoryTrends: [] as CategoryTrend[],
    incomeSources: [] as IncomeSource[],
    investmentCategories: [...INVESTMENT_CATEGORIES],
    currency: 'EUR'
  };
  if (rows.length === 0) return base;

  // ---- fold the rows into the shapes everything else reads --------------
  const byMonth = new Map<string, Bucket>();
  const byYear = new Map<number, Bucket>();
  const monthsPerYear = new Map<number, Set<number>>();
  const spendByCategoryMonth = new Map<string, Map<string, number>>();
  const spendByCategoryYear = new Map<string, Record<number, number>>();
  const incomeByCategoryYear = new Map<string, Record<number, number>>();

  for (const row of rows) {
    const { year, month, category, type } = row._id;
    const key = monthKey(year, month);
    const isInvestment = type === 'expense' && INVESTMENT_CATEGORIES.has(category);

    const monthBucket = byMonth.get(key) || emptyBucket();
    const yearBucket = byYear.get(year) || emptyBucket();
    monthBucket[type] += row.total;
    yearBucket[type] += row.total;
    if (isInvestment) {
      monthBucket.invested += row.total;
      yearBucket.invested += row.total;
    }
    byMonth.set(key, monthBucket);
    byYear.set(year, yearBucket);

    const seen = monthsPerYear.get(year) || new Set<number>();
    seen.add(month);
    monthsPerYear.set(year, seen);

    if (type === 'expense') {
      const perMonth = spendByCategoryMonth.get(category) || new Map<string, number>();
      perMonth.set(key, (perMonth.get(key) || 0) + row.total);
      spendByCategoryMonth.set(category, perMonth);

      const perYear = spendByCategoryYear.get(category) || {};
      perYear[year] = (perYear[year] || 0) + row.total;
      spendByCategoryYear.set(category, perYear);
    } else {
      const perYear = incomeByCategoryYear.get(category) || {};
      perYear[year] = (perYear[year] || 0) + row.total;
      incomeByCategoryYear.set(category, perYear);
    }
  }

  // ---- month series -----------------------------------------------------
  const presentMonths = [...byMonth.keys()].sort();
  const allMonths = monthRange(presentMonths[0], presentMonths[presentMonths.length - 1]);
  const months: PeriodPoint[] = allMonths.map((period) => {
    const bucket = byMonth.get(period) || emptyBucket();
    const consumption = bucket.expense - bucket.invested;
    return {
      period,
      income: bucket.income,
      expense: bucket.expense,
      savings: bucket.income - consumption
    };
  });

  // ---- trailing windows -------------------------------------------------
  // Anchored on the newest month that has data rather than on today: an import
  // can lag by weeks, and a window ending in an empty month would report a
  // collapse in both income and spending that never happened.
  const currentWindow = allMonths.slice(-TRAILING_MONTHS);
  const previousWindow = allMonths.slice(-TRAILING_MONTHS * 2, -TRAILING_MONTHS);

  const foldWindow = (window: string[]): Bucket =>
    window.reduce((acc, key) => {
      const bucket = byMonth.get(key) || emptyBucket();
      acc.income += bucket.income;
      acc.expense += bucket.expense;
      acc.invested += bucket.invested;
      return acc;
    }, emptyBucket());

  const trailing = {
    current: summarize(
      foldWindow(currentWindow),
      currentWindow.length,
      currentWindow[0],
      currentWindow[currentWindow.length - 1]
    ),
    previous:
      previousWindow.length > 0
        ? summarize(
            foldWindow(previousWindow),
            previousWindow.length,
            previousWindow[0],
            previousWindow[previousWindow.length - 1]
          )
        : null
  };

  // ---- years ------------------------------------------------------------
  const orderedYears = [...byYear.keys()].sort((a, b) => a - b);
  const years: YearSummary[] = orderedYears.map((year, index) => {
    const bucket = byYear.get(year)!;
    const covered = monthsPerYear.get(year)?.size ?? 0;
    const previous = index > 0 ? byYear.get(orderedYears[index - 1])! : null;

    const incomeChange = previous ? bucket.income - previous.income : null;
    const expenseChange = previous ? bucket.expense - previous.expense : null;

    return {
      year,
      ...summarize(bucket, covered, monthKey(year, 1), monthKey(year, 12)),
      incomeChange,
      incomeChangePct: incomeChange === null ? null : pct(incomeChange, previous!.income),
      expenseChange,
      expenseChangePct: expenseChange === null ? null : pct(expenseChange, previous!.expense),
      partial: covered < 12
    };
  });

  // ---- categories, compared on the trailing windows ----------------------
  const sumWindow = (perMonth: Map<string, number>, window: string[]) =>
    window.reduce((sum, key) => sum + (perMonth.get(key) || 0), 0);

  const categoryTrends: CategoryTrend[] = [...spendByCategoryMonth.entries()]
    .map(([category, perMonth]) => {
      const latest = sumWindow(perMonth, currentWindow);
      const previous = sumWindow(perMonth, previousWindow);
      const total = [...perMonth.values()].reduce((sum, v) => sum + v, 0);

      return {
        category,
        byYear: spendByCategoryYear.get(category) || {},
        total,
        latest,
        previous,
        change: latest - previous,
        changePct: pct(latest - previous, previous),
        perMonth: currentWindow.length > 0 ? latest / currentWindow.length : 0
      };
    })
    .sort((a, b) => b.latest - a.latest);

  const incomeSources: IncomeSource[] = [...incomeByCategoryYear.entries()]
    .map(([category, perYear]) => ({
      category,
      byYear: perYear,
      total: Object.values(perYear).reduce((sum, v) => sum + v, 0)
    }))
    .sort((a, b) => b.total - a.total);

  return {
    years,
    months,
    trailing,
    categoryTrends,
    incomeSources,
    investmentCategories: [...INVESTMENT_CATEGORIES],
    currency: 'EUR'
  };
};
