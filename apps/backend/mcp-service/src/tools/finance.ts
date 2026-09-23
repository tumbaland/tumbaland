import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { finance } from '../finance';
import { Caller, ToolModule, dateSchema, explain, groupIdFor, journalSchema, ok, resolveJournal } from './module';
import { money } from './financeFormat';
import { registerSpendingTools } from './financeSpending';
import { registerWealthTools } from './financeWealth';

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

function registerReadTools(server: McpServer, caller: Caller): void {
  registerWealthTools(server, caller);
  registerSpendingTools(server, caller);
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
