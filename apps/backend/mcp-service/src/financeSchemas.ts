import { z } from 'zod';

/**
 * The shapes finance-service answers with, parsed at the boundary.
 *
 * Derived from documents the live database actually holds, not from reading
 * the models: see the note at the top of finance.ts.
 */

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

/**
 * A position that was bought and then sold out entirely. The money figures are
 * absent when the instrument's currency has no exchange rate yet, which the
 * service says with `missingFxRate` rather than passing a foreign amount off as
 * base currency.
 */
export const closedPositionSchema = z
  .object({
    ticker: z.string(),
    displayName: z.string().optional(),
    currency: z.string().optional(),
    baseCurrency: z.string().optional(),
    firstTradeDate: z.string(),
    closedDate: z.string(),
    bought: z.number().optional(),
    proceeds: z.number().optional(),
    realizedGain: z.number().optional(),
    dividends: z.number().optional(),
    totalReturn: z.number().optional(),
    fees: z.number().optional(),
    tradeCount: z.number().optional(),
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
    /** where earned income came from; absent from a service that predates it */
    incomeBy: z
      .object({
        salary: z.number(),
        dividends: z.number(),
        interest: z.number(),
        other: z.number()
      })
      .optional(),
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
        unconverted: z.number().optional(),
        /** received, from positions held and from ones since sold */
        dividends: z.number().optional(),
        /** gains crystallised by selling, held and sold positions together */
        realizedGain: z.number().optional()
      })
      .loose()
      .nullable()
      .optional(),
    /**
     * How reachable the money is, and how many months of spending it covers.
     * Absent from a finance-service that predates it, and every figure in it is
     * optional for the same reason: the tool says less, it does not fail.
     */
    safety: z
      .object({
        cash: z.number().optional(),
        market: z.number().optional(),
        locked: z.number().optional(),
        unsorted: z.number().optional(),
        monthlySpending: z.number().nullable().optional(),
        cashMonths: z.number().nullable().optional(),
        reachableMonths: z.number().nullable().optional()
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
export type ClosedPosition = z.infer<typeof closedPositionSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Analytics = z.infer<typeof analyticsSchema>;
export type Recurring = z.infer<typeof recurringSchema>;
export type Summary = z.infer<typeof summarySchema>;
export type PeriodTotals = z.infer<typeof periodTotalsSchema>;
export type Growth = z.infer<typeof growthSchema>;
