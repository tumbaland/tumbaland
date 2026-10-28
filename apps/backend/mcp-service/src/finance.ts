import { z } from 'zod';
import { callService, serviceUrl } from './http';
import { parseResponse } from './schemas';
import {
  type Analytics,
  type Dashboard,
  type Holding,
  type Recurring,
  type Summary,
  type Trade,
  analyticsSchema,
  dashboardSchema,
  holdingSchema,
  recurringSchema,
  summarySchema,
  tradeSchema,
  transactionPageSchema
} from './financeSchemas';

export * from './financeSchemas';

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
