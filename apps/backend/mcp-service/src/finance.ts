import { z } from 'zod';
import { callService, serviceUrl } from './http';
import { parseResponse } from './schemas';

/**
 * A thin client over the finance API.
 *
 * Same reasoning as the relationship client: every rule that makes a write
 * correct already lives in the service, so this forwards the caller's own
 * credential and lets finance-service decide.
 *
 * The schemas below were derived from documents the live database actually
 * holds, not from reading the models. That distinction is the whole reason the
 * relationship client has boundary parsing at all — four separate bugs there
 * came from a client assuming a shape, the tests mocking the same assumption,
 * and both agreeing with each other while disagreeing with the service.
 */

const financeUrl = () => serviceUrl('FINANCE');

const call = <T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> => callService<T>(financeUrl(), apiKey, method, path, body, query);

export const transactionSchema = z
  .object({
    _id: z.string(),
    date: z.string(),
    amount: z.number(),
    /**
     * The only two the model defines and the only two the data holds. A value
     * outside them reads as an expense rather than failing the parse: getting
     * one row's direction wrong beats refusing to answer a question about
     * three thousand of them.
     */
    type: z.enum(['income', 'expense']).catch('expense'),
    category: z.string().catch('Uncategorised'),
    /** the statement line, which is where a merchant name actually lives */
    note: z.string().optional()
  })
  .loose();

/** `/transactions` answers with a page plus totals over the whole filter. */
export const transactionPageSchema = z
  .object({
    items: z.array(transactionSchema),
    totals: z
      .object({
        count: z.number(),
        income: z.number(),
        expense: z.number(),
        net: z.number()
      })
      .loose(),
    hasMore: z.boolean().catch(false)
  })
  .loose();

/**
 * A position as the API returns it, not as the database stores it.
 *
 * `/holdings` enriches every row in the service layer — the stored document has
 * only ticker, quantity and average price, and everything a person actually
 * wants to know about a position is computed on the way out. Building this from
 * the document was the mistake that shipped a portfolio tool unable to say what
 * anything was worth.
 *
 * Every derived field is optional because each of them genuinely can be absent:
 * a ticker the price job has never covered has no price and therefore no value,
 * and a holding entered by hand has no trade log to derive realised gains from.
 */
export const holdingSchema = z
  .object({
    _id: z.string(),
    ticker: z.string(),
    quantity: z.number(),
    avgBuyPrice: z.number(),
    displayName: z.string().optional(),
    baseCurrency: z.string().optional(),
    /** the last price the daily job recorded, in the instrument's own currency */
    latestPrice: z.number().optional(),
    latestPriceDate: z.string().optional(),
    /** quantity x latest price, converted to base currency */
    currentValue: z.number().optional(),
    costBasis: z.number().optional(),
    valueIncrease: z.number().optional(),
    percentIncrease: z.number().optional(),
    realizedGain: z.number().optional(),
    dividends: z.number().optional(),
    /** true when the instrument is quoted in a currency with no rate available */
    missingFxRate: z.boolean().optional()
  })
  .loose();

export const tradeSchema = z
  .object({
    _id: z.string(),
    ticker: z.string(),
    type: z.string(),
    date: z.string(),
    quantity: z.number().optional(),
    price: z.number().optional(),
    amount: z.number().optional(),
    fees: z.number().optional(),
    notes: z.string().optional()
  })
  .loose();

/**
 * The aggregate endpoints, parsed rather than forwarded.
 *
 * These four used to be typed `unknown` and handed to the model as
 * pretty-printed JSON, on the reasoning that numbers are better quoted than
 * re-described. That was right about the numbers and wrong about the volume:
 * `/dashboard` carries one history point per day for ever, `/analytics` one per
 * month, and between them a single question about money cost twenty thousand
 * tokens of context that every later turn in the conversation paid for again.
 *
 * So the shapes are named here, and the tools render the part worth reading.
 * The endpoints are untouched — the app's charts need every point, and an
 * assistant answering "how are we doing" needs eleven year-end figures.
 *
 * Everything is `.loose()` and the derived fields are optional, for the reason
 * the holding schema explains at length: these were read off live responses,
 * and a field this server does not use must never be the thing that fails a
 * call.
 */
const periodTotalsSchema = z
  .object({
    income: z.number(),
    expense: z.number(),
    /** what was spent and gone, as opposed to moved into an asset */
    consumption: z.number(),
    invested: z.number(),
    divested: z.number().optional(),
    savings: z.number(),
    /** null when there was no income to take a share of */
    savingsRate: z.number().nullable().optional(),
    months: z.number().optional(),
    from: z.string().optional(),
    to: z.string().optional()
  })
  .loose();

/** Why net worth moved: the market, or money added to it. */
const growthSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    months: z.number().optional(),
    netWorthChange: z.number(),
    contributions: z.number(),
    marketGrowth: z.number(),
    /** false when a gap in the data means the split does not add up */
    complete: z.boolean().optional()
  })
  .loose();

export const dashboardSchema = z
  .object({
    kpis: z
      .object({
        netWorth: z.number(),
        assets: z.number(),
        liabilities: z.number(),
        /** the date of the latest snapshot, so a stale figure is not quoted as "now" */
        asOf: z.string().nullable().optional(),
        monthChange: z.number().nullable().optional(),
        monthChangePct: z.number().nullable().optional(),
        yearChange: z.number().nullable().optional(),
        yearChangePct: z.number().nullable().optional(),
        totalGain: z.number().optional(),
        totalGainPct: z.number().optional()
      })
      .loose(),
    netWorthHistory: z
      .array(z.object({ date: z.string(), total: z.number() }).loose())
      .catch([]),
    allocation: z
      .array(
        z
          .object({
            name: z.string(),
            value: z.number(),
            gain: z.number().optional(),
            percentage: z.number().optional()
          })
          .loose()
      )
      .catch([]),
    liabilities: z
      .array(z.object({ name: z.string(), value: z.number() }).loose())
      .catch([]),
    currency: z.string().optional(),
    cashflow: z
      .object({
        trailing: periodTotalsSchema,
        previous: periodTotalsSchema.nullable().optional(),
        growth: growthSchema.nullable().optional()
      })
      .loose()
      .nullable()
      .optional(),
    holdings: z
      .object({
        count: z.number(),
        totalValue: z.number(),
        totalCost: z.number(),
        gain: z.number(),
        gainPct: z.number(),
        /** left out of the totals because no exchange rate was available */
        unconverted: z.number().optional()
      })
      .loose()
      .nullable()
      .optional()
  })
  .loose();

export const analyticsSchema = z
  .object({
    years: z
      .array(
        periodTotalsSchema.safeExtend({
          year: z.number(),
          incomeChangePct: z.number().nullable().optional(),
          expenseChangePct: z.number().nullable().optional(),
          /** the year is still running, so its totals are not comparable */
          partial: z.boolean().optional()
        })
      )
      .catch([]),
    trailing: z
      .object({
        current: periodTotalsSchema,
        previous: periodTotalsSchema.nullable().optional()
      })
      .loose()
      .optional(),
    categoryTrends: z
      .array(
        z
          .object({
            category: z.string(),
            /** the trailing window, and the window before it */
            latest: z.number(),
            previous: z.number().optional(),
            change: z.number().optional(),
            changePct: z.number().nullable().optional()
          })
          .loose()
      )
      .catch([]),
    incomeSources: z
      .array(
        z
          .object({
            category: z.string(),
            total: z.number(),
            byYear: z.record(z.string(), z.number()).optional()
          })
          .loose()
      )
      .catch([]),
    /** the categories that mean "moved into an asset" rather than "spent" */
    investmentCategories: z.array(z.string()).catch([]),
    currency: z.string().optional()
  })
  .loose();

export const recurringSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    monthlyTotal: z.number(),
    yearlyTotal: z.number(),
    lapsedCount: z.number().optional(),
    payments: z
      .array(
        z
          .object({
            merchant: z.string(),
            category: z.string().optional(),
            cadence: z.string().optional(),
            /** the median charge, so one annual surcharge cannot set the figure */
            amount: z.number(),
            monthlyEquivalent: z.number().optional(),
            lastCharge: z.string().optional(),
            nextExpected: z.string().optional(),
            daysUntilNext: z.number().optional(),
            status: z.string().optional(),
            priceChange: z
              .object({
                previousAmount: z.number(),
                currentAmount: z.number(),
                changedOn: z.string().optional()
              })
              .loose()
              .nullable()
              .optional()
          })
          .loose()
      )
      .catch([])
  })
  .loose();

export const summarySchema = z
  .object({
    months: z
      .array(
        z
          .object({
            month: z.string(),
            income: z.number(),
            expense: z.number(),
            savings: z.number(),
            savingsRate: z.number().nullable().optional()
          })
          .loose()
      )
      .catch([]),
    /** spending per category, averaged per month so windows compare */
    categories: z
      .array(z.object({ category: z.string(), spent: z.number() }).loose())
      .catch([]),
    totals: z
      .object({
        income: z.number(),
        expense: z.number(),
        savings: z.number(),
        savingsRate: z.number().nullable().optional()
      })
      .loose()
      .optional(),
    growthTrailing: growthSchema.nullable().optional()
  })
  .loose();

export type Transaction = z.infer<typeof transactionSchema>;
export type Holding = z.infer<typeof holdingSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Analytics = z.infer<typeof analyticsSchema>;
export type Recurring = z.infer<typeof recurringSchema>;
export type Summary = z.infer<typeof summarySchema>;
export type PeriodTotals = z.infer<typeof periodTotalsSchema>;
export type Growth = z.infer<typeof growthSchema>;

export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: 'income' | 'expense';
  category?: string;
  search?: string;
  limit?: number;
  groupId?: string;
}

export const finance = {
  listTransactions: async (apiKey: string, filters: TransactionFilters) => {
    const body = await call<unknown>(apiKey, 'GET', '/transactions', undefined, {
      ...filters,
      // Newest first, for the same reason the journal search is: a person
      // scrolling wants the start of their history, an agent wants the end.
      sort: 'date',
      direction: 'desc'
    });
    return parseResponse(transactionPageSchema, '/transactions', body);
  },

  /** Month-by-month income and spending, plus the categories behind it. */
  getSummary: async (apiKey: string, months?: number, groupId?: string): Promise<Summary> => {
    const body = await call<unknown>(apiKey, 'GET', '/transactions/summary', undefined, {
      months,
      groupId
    });
    return parseResponse(summarySchema, '/transactions/summary', body);
  },

  /**
   * Year-on-year income and spending, and which categories moved.
   *
   * Distinct from the summary: that answers "what did we spend", this answers
   * "what changed and why" — including the split between what was consumed and
   * what was put into assets, which is the difference between overspending and
   * investing.
   */
  getAnalytics: async (apiKey: string, groupId?: string): Promise<Analytics> => {
    const body = await call<unknown>(apiKey, 'GET', '/transactions/analytics', undefined, { groupId });
    return parseResponse(analyticsSchema, '/transactions/analytics', body);
  },

  /** What is paid on a schedule — subscriptions, rent, insurance. */
  getRecurring: async (apiKey: string, months?: number, groupId?: string): Promise<Recurring> => {
    const body = await call<unknown>(apiKey, 'GET', '/transactions/recurring', undefined, {
      months,
      groupId
    });
    return parseResponse(recurringSchema, '/transactions/recurring', body);
  },

  /** Net worth, its history, and how it is allocated. */
  getDashboard: async (apiKey: string, groupId?: string): Promise<Dashboard> => {
    const body = await call<unknown>(apiKey, 'GET', '/dashboard', undefined, { groupId });
    return parseResponse(dashboardSchema, '/dashboard', body);
  },

  listHoldings: async (apiKey: string, groupId?: string): Promise<Holding[]> => {
    const body = await call<unknown>(apiKey, 'GET', '/holdings', undefined, { groupId });
    return parseResponse(z.array(holdingSchema), '/holdings', body);
  },

  listTrades: async (apiKey: string, groupId?: string): Promise<Trade[]> => {
    const body = await call<unknown>(apiKey, 'GET', '/trades', undefined, { groupId });
    return parseResponse(z.array(tradeSchema), '/trades', body);
  },

  createTrade: (
    apiKey: string,
    trade: {
      ticker: string;
      type: 'buy' | 'sell' | 'dividend' | 'fee';
      date: string;
      quantity?: number;
      price?: number;
      amount?: number;
      fees?: number;
      notes?: string;
    },
    groupId?: string
  ): Promise<unknown> => call(apiKey, 'POST', '/trades', trade, { groupId }),

  recategorise: (
    apiKey: string,
    move: { fromCategory: string; toCategory: string; search?: string },
    groupId?: string
  ): Promise<{ updated: number }> =>
    call<{ updated: number }>(apiKey, 'POST', '/transactions/recategorise', move, { groupId }),

  listCategories: async (apiKey: string, groupId?: string): Promise<string[]> => {
    const body = await call<unknown>(apiKey, 'GET', '/transactions/categories', undefined, { groupId });
    return parseResponse(z.array(z.string()), '/transactions/categories', body);
  }
};
