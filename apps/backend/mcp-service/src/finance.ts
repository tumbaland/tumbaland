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

export type Transaction = z.infer<typeof transactionSchema>;
export type Holding = z.infer<typeof holdingSchema>;
export type Trade = z.infer<typeof tradeSchema>;

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
  getSummary: (apiKey: string, months?: number, groupId?: string): Promise<unknown> =>
    call(apiKey, 'GET', '/transactions/summary', undefined, { months, groupId }),

  /**
   * Year-on-year income and spending, and which categories moved.
   *
   * Distinct from the summary: that answers "what did we spend", this answers
   * "what changed and why" — including the split between what was consumed and
   * what was put into assets, which is the difference between overspending and
   * investing.
   */
  getAnalytics: (apiKey: string, groupId?: string): Promise<unknown> =>
    call(apiKey, 'GET', '/transactions/analytics', undefined, { groupId }),

  /** What is paid on a schedule — subscriptions, rent, insurance. */
  getRecurring: (apiKey: string, months?: number, groupId?: string): Promise<unknown> =>
    call(apiKey, 'GET', '/transactions/recurring', undefined, { months, groupId }),

  /** Net worth, its history, and how it is allocated. */
  getDashboard: (apiKey: string, groupId?: string): Promise<unknown> =>
    call(apiKey, 'GET', '/dashboard', undefined, { groupId }),

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
