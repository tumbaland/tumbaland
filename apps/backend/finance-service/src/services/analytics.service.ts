import Transaction from '../models/Transaction';
import { scopeFor } from '../utils/scope';
import { INVESTMENT_CATEGORIES } from './bankStatement.service';

export interface YearSummary {
  year: number;
  income: number;
  /** Everything that left the account, consumption and investing alike. */
  expense: number;
  /** What was actually consumed — `expense` less money moved into assets. */
  consumption: number;
  /** Money moved into crypto, a broker or a savings product. */
  invested: number;
  savings: number;
  /**
   * Share of income not consumed. Investing is not spending, so a month that
   * put 4 000 into a broker reads as saved rather than as a savings-rate crash.
   */
  savingsRate: number | null;
  /** Change against the previous year, null for the first year on record. */
  incomeChange: number | null;
  incomeChangePct: number | null;
  expenseChange: number | null;
  expenseChangePct: number | null;
}

export interface CategoryTrend {
  category: string;
  /** Spend per year, keyed by year, for a sparkline. */
  byYear: Record<number, number>;
  total: number;
  latest: number;
  previous: number;
  change: number;
  changePct: number | null;
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
  /** Category names treated as investing rather than spending. */
  investmentCategories: string[];
  /**
   * The same totals as `years` but per month, so the charts can switch
   * granularity without a second request. Months with no activity are filled
   * in as zero: a gap in the series would otherwise read as a flat line
   * between two distant points rather than as a month with no spending.
   */
  months: PeriodPoint[];
  /** Biggest movers in spending between the two most recent complete years. */
  categoryTrends: CategoryTrend[];
  incomeSources: IncomeSource[];
  /** Mean monthly spend per year, which is easier to compare than annual totals. */
  monthlyAverages: Array<{ year: number; income: number; expense: number; months: number }>;
  currency: string;
}

const pct = (change: number, base: number): number | null =>
  base > 0 ? (change / base) * 100 : null;

interface MonthTotalRow {
  _id: { year: number; month: number; type: string };
  total: number;
}

/**
 * Longest month series worth returning — fifty years. Zero-filling runs from the
 * first month with activity to the last, so one transaction carrying a corrupt
 * far-future date would otherwise generate tens of thousands of empty points
 * and hand the browser a chart it cannot draw.
 */
const MAX_MONTH_POINTS = 600;

/**
 * A continuous month-by-month series from the first month with activity to the
 * last, zero-filled. A chart drawn from sparse points would join two distant
 * months with a straight line and imply spending that never happened.
 */
function buildMonthSeries(rows: MonthTotalRow[]): PeriodPoint[] {
  if (rows.length === 0) return [];

  const totals = new Map<string, { income: number; expense: number }>();
  for (const row of rows) {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
    const bucket = totals.get(key) || { income: 0, expense: 0 };
    bucket[row._id.type as 'income' | 'expense'] = row.total;
    totals.set(key, bucket);
  }

  const keys = [...totals.keys()].sort();
  const [firstYear, firstMonth] = keys[0].split('-').map(Number);
  const [lastYear, lastMonth] = keys[keys.length - 1].split('-').map(Number);

  const series: PeriodPoint[] = [];
  const cursor = new Date(Date.UTC(firstYear, firstMonth - 1, 1));
  const end = new Date(Date.UTC(lastYear, lastMonth - 1, 1));

  while (cursor <= end && series.length < MAX_MONTH_POINTS) {
    const period = cursor.toISOString().slice(0, 7);
    const { income, expense } = totals.get(period) || { income: 0, expense: 0 };
    series.push({ period, income, expense, savings: income - expense });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Truncating from the front keeps the recent end, which is the part anyone
  // looks at, rather than fifty years of leading zeroes.
  return series.length < MAX_MONTH_POINTS ? series : series.slice(-MAX_MONTH_POINTS);
}

/**
 * Long-run view of the cash-flow history: how income and spending have moved
 * year on year, which categories are driving the change, and where the income
 * came from.
 *
 * Everything is computed in Mongo rather than by pulling the rows out — the
 * history runs to thousands of transactions and only the aggregates are wanted.
 */
export const getAnalytics = async (userId: string, groupId?: string): Promise<Analytics> => {
  const scope = scopeFor(userId, groupId);

  const [byYearType, byCategoryYear, monthsPerYear, byMonthType] = await Promise.all([
    Transaction.aggregate([
      { $match: scope },
      {
        $group: {
          _id: { year: { $year: '$date' }, type: '$type' },
          total: { $sum: '$amount' }
        }
      }
    ]),
    Transaction.aggregate([
      { $match: scope },
      {
        $group: {
          _id: { year: { $year: '$date' }, category: '$category', type: '$type' },
          total: { $sum: '$amount' }
        }
      }
    ]),
    // How many distinct months each year actually has data for, so a partial
    // year is averaged over the months it covers instead of a flat twelve.
    Transaction.aggregate([
      { $match: scope },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } } } },
      { $group: { _id: '$_id.year', months: { $sum: 1 } } }
    ]),
    Transaction.aggregate([
      { $match: scope },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
          total: { $sum: '$amount' }
        }
      }
    ])
  ]);

  // ---- per-year totals -----------------------------------------------------
  const yearTotals = new Map<number, { income: number; expense: number }>();
  for (const row of byYearType) {
    const bucket = yearTotals.get(row._id.year) || { income: 0, expense: 0 };
    bucket[row._id.type as 'income' | 'expense'] = row.total;
    yearTotals.set(row._id.year, bucket);
  }

  // How much of each year's outgoings went into an asset rather than being spent
  const investedByYear = new Map<number, number>();
  for (const row of byCategoryYear) {
    if (row._id.type !== 'expense' || !INVESTMENT_CATEGORIES.has(row._id.category)) continue;
    investedByYear.set(row._id.year, (investedByYear.get(row._id.year) || 0) + row.total);
  }

  const orderedYears = [...yearTotals.keys()].sort((a, b) => a - b);
  const years: YearSummary[] = orderedYears.map((year, index) => {
    const { income, expense } = yearTotals.get(year)!;
    const previous = index > 0 ? yearTotals.get(orderedYears[index - 1])! : null;
    const invested = investedByYear.get(year) || 0;
    const consumption = expense - invested;

    const incomeChange = previous ? income - previous.income : null;
    const expenseChange = previous ? expense - previous.expense : null;

    return {
      year,
      income,
      expense,
      consumption,
      invested,
      savings: income - consumption,
      savingsRate: income > 0 ? ((income - consumption) / income) * 100 : null,
      incomeChange,
      incomeChangePct: previous && incomeChange !== null ? pct(incomeChange, previous.income) : null,
      expenseChange,
      expenseChangePct: previous && expenseChange !== null ? pct(expenseChange, previous.expense) : null
    };
  });

  // ---- category trends -----------------------------------------------------
  const spendByCategory = new Map<string, Record<number, number>>();
  const incomeByCategory = new Map<string, Record<number, number>>();

  for (const row of byCategoryYear) {
    const target = row._id.type === 'expense' ? spendByCategory : incomeByCategory;
    const byYear = target.get(row._id.category) || {};
    byYear[row._id.year] = row.total;
    target.set(row._id.category, byYear);
  }

  const latestYear = orderedYears[orderedYears.length - 1];
  const previousYear = orderedYears[orderedYears.length - 2];

  const categoryTrends: CategoryTrend[] = [...spendByCategory.entries()]
    .map(([category, byYear]) => {
      const latest = byYear[latestYear] || 0;
      const previous = previousYear === undefined ? 0 : byYear[previousYear] || 0;
      const total = Object.values(byYear).reduce((sum, v) => sum + v, 0);
      return {
        category,
        byYear,
        total,
        latest,
        previous,
        change: latest - previous,
        changePct: pct(latest - previous, previous)
      };
    })
    .sort((a, b) => b.total - a.total);

  const incomeSources: IncomeSource[] = [...incomeByCategory.entries()]
    .map(([category, byYear]) => ({
      category,
      byYear,
      total: Object.values(byYear).reduce((sum, v) => sum + v, 0)
    }))
    .sort((a, b) => b.total - a.total);

  // ---- monthly averages ----------------------------------------------------
  const monthsByYear = new Map<number, number>(monthsPerYear.map((r) => [r._id, r.months]));
  const monthlyAverages = orderedYears.map((year) => {
    const { income, expense } = yearTotals.get(year)!;
    const months = monthsByYear.get(year) || 12;
    return { year, income: income / months, expense: expense / months, months };
  });

  return { years, investmentCategories: [...INVESTMENT_CATEGORIES], months: buildMonthSeries(byMonthType), categoryTrends, incomeSources, monthlyAverages, currency: 'EUR' };
};
