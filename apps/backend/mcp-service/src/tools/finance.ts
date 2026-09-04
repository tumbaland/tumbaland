import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { finance, Transaction } from '../finance';
import { Caller, ToolModule, dateSchema, explain, groupIdFor, journalSchema, ok, resolveJournal } from './module';

/**
 * Money: what came in, what went out, and what it all adds up to.
 *
 * Seven tools over forty-three routes, shaped by the questions people ask
 * rather than by the endpoints that answer them. One tool per route would bury
 * the four anyone actually wants under thirty-nine they do not.
 *
 * Nothing here creates a transaction, because nothing in the product does:
 * transactions arrive by importing a bank statement, and the only write paths
 * are the ones a person genuinely performs by hand — recording a trade, and
 * moving badly-categorised rows to the right category.
 */

/** Amounts read as money, not as bare numbers a model has to label itself. */
const money = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Counts get separators too: "7484 matching" is a number to decode, not read. */
const count = (value: number): string => value.toLocaleString('en-US');

const describeTransaction = (transaction: Transaction): string => {
  const day = transaction.date.slice(0, 10);
  const sign = transaction.type === 'income' ? '+' : '−';
  const detail = transaction.note ? ` — ${transaction.note}` : '';
  return `- ${day}: ${sign}${money(Math.abs(transaction.amount))} ${transaction.category}${detail}  [id ${transaction._id}]`;
};

function registerReadTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;

  server.registerTool(
    'get_net_worth',
    {
      title: 'Net worth and allocation',
      description:
        'What everything adds up to right now, how it has moved over the last month and year, and ' +
        'how it is split across asset classes. Use for "how are we doing", "what are we worth", ' +
        '"how much has it grown".',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const dashboard = await finance.getDashboard(apiKey, groupIdFor(resolveJournal(caller, journal)));
        // Returned as JSON: these are numbers the model will quote and compare,
        // and re-describing them here would only add a layer to be wrong in.
        return ok(JSON.stringify(dashboard, null, 2));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'get_spending',
    {
      title: 'Income and spending over time',
      description:
        'Month-by-month income, spending and what was saved, plus the categories the money went ' +
        'to. Use for "what do we spend on", "how much went out last month", "are we saving more ' +
        'than last year".',
      inputSchema: {
        months: z
          .number()
          .int()
          .min(1)
          .max(120)
          .optional()
          .describe('How many months back to cover (default 12)'),
        ...journalSchema(caller)
      }
    },
    async ({ months, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const summary = await finance.getSummary(apiKey, months, groupId);
        return ok(JSON.stringify(summary, null, 2));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'search_transactions',
    {
      title: 'Search transactions',
      description:
        'Individual payments, newest first, narrowed by date, category, direction or text. The ' +
        'text search covers the statement line, which is where the merchant name is — search ' +
        '"Selver" to find a shop. Use for "what was that big payment", "how much did we spend at X".',
      inputSchema: {
        from: dateSchema.optional().describe('Earliest day to include'),
        to: dateSchema.optional().describe('Latest day to include'),
        category: z.string().optional().describe('Narrow to one category — call get_spending to see them'),
        type: z.enum(['income', 'expense']).optional().describe('Money in or money out'),
        search: z.string().optional().describe('Text to look for in the statement line'),
        limit: z.number().int().min(1).max(100).optional().describe('How many at most (default 20)'),
        ...journalSchema(caller)
      }
    },
    async ({ from, to, category, type, search, limit, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const page = await finance.listTransactions(apiKey, {
          from,
          to,
          category,
          type,
          search,
          limit: limit ?? 20,
          groupId
        });

        if (page.items.length === 0) return ok('No transactions match that.');

        // Totals cover the whole filter, not the page — quoting the page's own
        // sum as "the total" is the mistake this makes impossible.
        const header =
          `${count(page.totals.count)} matching, totalling ${money(page.totals.expense)} out and ` +
          `${money(page.totals.income)} in. Showing the ${page.items.length} most recent:`;

        return ok(`${header}\n${page.items.map(describeTransaction).join('\n')}`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'get_spending_trends',
    {
      title: 'What changed year on year',
      description:
        'Income and spending by calendar year, which categories moved and by how much, and the ' +
        'split between money consumed and money put into assets. Use for "are we spending more ' +
        'than last year", "what has gone up", "where is the money actually going" — the questions ' +
        'get_spending cannot answer because it only covers a recent window.',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const analytics = await finance.getAnalytics(
          apiKey,
          groupIdFor(resolveJournal(caller, journal))
        );
        return ok(JSON.stringify(analytics, null, 2));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'list_recurring_payments',
    {
      title: 'Recurring payments',
      description:
        'What is paid on a schedule — subscriptions, rent, insurance — with how much and how ' +
        'often. Use for "what are we paying for every month", "what subscriptions do we have".',
      inputSchema: {
        months: z
          .number()
          .int()
          .min(3)
          .max(60)
          .optional()
          .describe('How far back to look for a pattern (default 12 months)'),
        ...journalSchema(caller)
      }
    },
    async ({ months, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const recurring = await finance.getRecurring(apiKey, months, groupId);
        return ok(JSON.stringify(recurring, null, 2));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'get_portfolio',
    {
      title: 'Investment positions and what they are worth',
      description:
        'Every position held, valued at the latest recorded price: what it cost, what it is worth ' +
        'now, and the gain in money and percent — plus the totals across the portfolio and the ' +
        'most recent trades. Use for "what do we hold", "how is the portfolio doing", "what is up ' +
        'or down", "should we rebalance".',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const [holdings, trades] = await Promise.all([
          finance.listHoldings(apiKey, groupId),
          finance.listTrades(apiKey, groupId)
        ]);

        if (holdings.length === 0) return ok('No positions are recorded.');

        // Only priced positions are summed. A ticker the price job has never
        // covered has no value, and counting it as zero would understate the
        // portfolio while looking like a complete answer.
        const priced = holdings.filter((holding) => holding.currentValue !== undefined);
        const value = priced.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
        const cost = priced.reduce((sum, holding) => sum + (holding.costBasis ?? 0), 0);
        const currency = holdings[0].baseCurrency ?? '';
        const asOf = holdings.find((holding) => holding.latestPriceDate)?.latestPriceDate;

        const lines = holdings.map((holding) => {
          const name = holding.displayName ? ` (${holding.displayName})` : '';
          if (holding.currentValue === undefined) {
            return `- ${holding.ticker}${name}: ${holding.quantity} units, cost ${money(holding.costBasis ?? 0)} — no price recorded, so it is left out of the totals`;
          }
          const change = holding.valueIncrease ?? 0;
          const pct = holding.percentIncrease ?? 0;
          return (
            `- ${holding.ticker}${name}: ${holding.quantity} units, worth ${money(holding.currentValue)}, ` +
            `cost ${money(holding.costBasis ?? 0)}, ${change >= 0 ? 'up' : 'down'} ${money(Math.abs(change))} ` +
            `(${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`
          );
        });

        const gain = value - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        const header =
          `Portfolio worth ${money(value)} ${currency} against ${money(cost)} invested — ` +
          `${gain >= 0 ? 'up' : 'down'} ${money(Math.abs(gain))} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)` +
          // Prices come from a daily job, so the date matters: quoting a stale
          // figure as "now" is the one way this can mislead.
          (asOf ? `, at prices from ${asOf.slice(0, 10)}` : '') +
          '.';

        const recent = trades.slice(0, 10).map((trade) => {
          const day = trade.date.slice(0, 10);
          const size =
            trade.quantity !== undefined && trade.price !== undefined
              ? `${trade.quantity} at ${money(trade.price)}`
              : money(trade.amount ?? 0);
          return `- ${day}: ${trade.type} ${trade.ticker}, ${size}  [id ${trade._id}]`;
        });

        return ok(
          `${header}\n\nPositions:\n${lines.join('\n')}\n\nMost recent trades:\n${recent.join('\n') || '(none)'}`
        );
      } catch (error) {
        return explain(error);
      }
    }
  );
}

function registerWriteTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;

  server.registerTool(
    'log_trade',
    {
      title: 'Record a trade',
      description:
        'Record a buy, sell, dividend or fee. Buys and sells take a quantity and a price per ' +
        'unit; dividends and fees take a total amount instead. Use for "I bought 10 shares of ' +
        'VWCE at 105 today".',
      inputSchema: {
        ticker: z.string().min(1).describe('The instrument, e.g. VWCE.DEX'),
        type: z.enum(['buy', 'sell', 'dividend', 'fee']),
        date: dateSchema,
        quantity: z.number().nonnegative().optional().describe('Units, for a buy or sell'),
        price: z.number().nonnegative().optional().describe('Price per unit, for a buy or sell'),
        amount: z.number().nonnegative().optional().describe('Cash total, for a dividend or fee'),
        fees: z.number().nonnegative().optional().describe('Commission or fee charged'),
        notes: z.string().max(500).optional(),
        ...journalSchema(caller)
      }
    },
    async ({ ticker, type, date, quantity, price, amount, fees, notes, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        await finance.createTrade(
          apiKey,
          { ticker, type, date, quantity, price, amount, fees, notes },
          groupId
        );

        const size =
          quantity !== undefined && price !== undefined
            ? `${quantity} at ${money(price)}`
            : money(amount ?? 0);
        return ok(`Recorded ${type} ${ticker} on ${date}: ${size}`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'recategorise_transactions',
    {
      title: 'Move transactions to another category',
      description:
        'Move every transaction in one category to another, optionally only those whose statement ' +
        'line matches some text. Use for "put the Bolt charges under Transport". This changes many ' +
        'rows at once and cannot be undone in one step, so say how many will move before doing it.',
      inputSchema: {
        fromCategory: z.string().min(1).describe('The category to move rows out of'),
        toCategory: z.string().min(1).describe('The category to move them into'),
        search: z
          .string()
          .optional()
          .describe('Only rows whose statement line contains this — leave out to move all of them'),
        ...journalSchema(caller)
      }
    },
    async ({ fromCategory, toCategory, search, journal }) => {
      try {
        const groupId = groupIdFor(resolveJournal(caller, journal));
        const { updated } = await finance.recategorise(
          apiKey,
          { fromCategory, toCategory, search },
          groupId
        );

        return ok(
          `Moved ${updated} transaction${updated === 1 ? '' : 's'} from ${fromCategory} to ${toCategory}.`
        );
      } catch (error) {
        return explain(error);
      }
    }
  );
}

export const financeRead: ToolModule = {
  scopes: ['finance:read'],
  register: registerReadTools
};

export const financeWrite: ToolModule = {
  scopes: ['finance:read', 'finance:write'],
  register: registerWriteTools
};
