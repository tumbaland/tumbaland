import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { finance } from '../finance';
import { Caller, dateSchema, explain, journalSchema, ok, tenantFor } from './module';
import { describeGrowth, describePeriod, describeTrade, money, moved, total } from './financeFormat';

/** What everything is worth: net worth, allocation, and the investment positions. */
export function registerWealthTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;

  server.registerTool(
    'get_net_worth',
    {
      title: 'Net worth and allocation',
      description:
        'What everything adds up to right now, how it has moved over the last month and year, how ' +
        'it is split across asset classes, and what it was worth at each year end. Use for "how ' +
        'are we doing", "what are we worth", "how much has it grown".',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const dashboard = await finance.getDashboard(apiKey, tenantFor(caller, journal));
        const { kpis } = dashboard;
        const currency = dashboard.currency ?? '';

        const lines: string[] = [
          `Net worth ${total(kpis.netWorth)} ${currency}`.trim() +
            // The snapshot date, not today. Prices come from a daily job, and a
            // figure quoted as "now" that is three days old is the one way this
            // tool can mislead without being wrong.
            (kpis.asOf ? ` as at ${kpis.asOf.slice(0, 10)}` : '') +
            `: ${total(kpis.assets)} in assets` +
            (kpis.liabilities ? `, ${total(kpis.liabilities)} owed` : ', nothing owed') +
            '.'
        ];

        if (kpis.monthChange !== null && kpis.monthChange !== undefined) {
          lines.push(`Over the month: ${moved(kpis.monthChange, kpis.monthChangePct)}.`);
        }
        if (kpis.yearChange !== null && kpis.yearChange !== undefined) {
          lines.push(`Over the year: ${moved(kpis.yearChange, kpis.yearChangePct)}.`);
        }
        if (kpis.totalGain !== undefined) {
          lines.push(`Since the start: ${moved(kpis.totalGain, kpis.totalGainPct)}.`);
        }

        if (dashboard.allocation.length > 0) {
          const allocation = dashboard.allocation.map((entry) => {
            const share = entry.percentage === undefined ? '' : ` (${entry.percentage.toFixed(0)}%)`;
            const gain = entry.gain === undefined ? '' : `, gain ${total(entry.gain)}`;
            return `- ${entry.name} ${total(entry.value)}${share}${gain}`;
          });
          lines.push('', 'Allocation:', ...allocation);
        }

        if (dashboard.liabilities.length > 0) {
          lines.push(
            '',
            'Owed:',
            ...dashboard.liabilities.map((entry) => `- ${entry.name} ${total(entry.value)}`)
          );
        }

        const holdings = dashboard.holdings;
        if (holdings) {
          lines.push(
            '',
            `${holdings.count} positions worth ${total(holdings.totalValue)} against ` +
              `${total(holdings.totalCost)} invested, ${moved(holdings.gain, holdings.gainPct)}.` +
              (holdings.unconverted
                ? ` ${holdings.unconverted} left out of the totals for want of an exchange rate.`
                : '')
          );
        }

        const cashflow = dashboard.cashflow;
        if (cashflow) {
          lines.push('', `Last 12 months, ${describePeriod(cashflow.trailing)}`);
          if (cashflow.previous) lines.push(`The 12 before, ${describePeriod(cashflow.previous)}`);
          const growth = describeGrowth(cashflow.growth);
          if (growth) lines.push(growth);
        }

        // Year ends, not the daily series the endpoint carries. The app's chart
        // needs every point; a question about the trajectory needs about ten,
        // and the full history was seven thousand tokens of context that every
        // later turn in the conversation paid for again.
        const byYear = new Map<string, number>();
        for (const point of dashboard.netWorthHistory) {
          byYear.set(point.date.slice(0, 4), point.total);
        }
        if (byYear.size > 1) {
          const series = [...byYear].map(([year, value]) => `${year} ${total(value)}`).join(', ');
          lines.push('', `Net worth at each year end: ${series}.`);
        }

        return ok(lines.join('\n'));
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
        const groupId = tenantFor(caller, journal);
        const [holdings, trades, closed] = await Promise.all([
          finance.listHoldings(apiKey, groupId),
          finance.listTrades(apiKey, groupId),
          // Sold positions are an addition to the answer, not the answer: a
          // finance-service that predates the endpoint should cost this tool
          // its extra section, not its portfolio. The holdings call beside it
          // fails on anything that is genuinely wrong.
          finance.listClosedPositions(apiKey, groupId).catch(() => [])
        ]);

        if (holdings.length === 0 && closed.length === 0) return ok('No positions are recorded.');

        // Only priced positions are summed. A ticker the price job has never
        // covered has no value, and counting it as zero would understate the
        // portfolio while looking like a complete answer.
        const priced = holdings.filter((holding) => holding.currentValue !== undefined);
        const value = priced.reduce((sum, holding) => sum + (holding.currentValue ?? 0), 0);
        const cost = priced.reduce((sum, holding) => sum + (holding.costBasis ?? 0), 0);
        const currency = holdings[0]?.baseCurrency ?? closed[0]?.baseCurrency ?? '';
        const asOf = holdings.find((holding) => holding.latestPriceDate)?.latestPriceDate;

        const lines = holdings.map((holding) => {
          const name = holding.displayName ? ` (${holding.displayName})` : '';
          if (holding.currentValue === undefined) {
            return `- ${holding.ticker}${name}: ${holding.quantity} units, cost ${money(holding.costBasis ?? 0)} — no price recorded, so it is left out of the totals`;
          }
          const change = holding.valueIncrease ?? 0;
          const pct = holding.percentIncrease ?? 0;
          const paid = holding.dividends ? `, dividends received ${money(holding.dividends)}` : '';
          return (
            `- ${holding.ticker}${name}: ${holding.quantity} units, worth ${money(holding.currentValue)}, ` +
            `cost ${money(holding.costBasis ?? 0)}, ${change >= 0 ? 'up' : 'down'} ${money(Math.abs(change))} ` +
            `(${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)${paid}`
          );
        });

        const gain = value - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        const header =
          holdings.length === 0
            ? 'No positions are held at the moment.'
            : `Portfolio worth ${money(value)} ${currency} against ${money(cost)} invested — ` +
          `${gain >= 0 ? 'up' : 'down'} ${money(Math.abs(gain))} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)` +
          // Prices come from a daily job, so the date matters: quoting a stale
          // figure as "now" is the one way this can mislead.
          (asOf ? `, at prices from ${asOf.slice(0, 10)}` : '') +
          '.';

        const recent = trades.slice(0, 10).map(describeTrade);

        // What the portfolio has paid and realised, counting the positions that
        // are gone: selling the last unit removes a holding, and with it every
        // figure it would have contributed here.
        const counted = closed.filter((position) => !position.missingFxRate);
        const sumOf = (pick: (position: (typeof closed)[number]) => number | undefined) =>
          counted.reduce((sum, position) => sum + (pick(position) ?? 0), 0);
        const openDividends = holdings.reduce((sum, holding) => sum + (holding.dividends ?? 0), 0);
        const openRealized = holdings.reduce((sum, holding) => sum + (holding.realizedGain ?? 0), 0);
        const soldDividends = sumOf((position) => position.dividends);
        const soldRealized = sumOf((position) => position.realizedGain);

        const sections = [header];
        if (holdings.length > 0) sections.push(`Positions:\n${lines.join('\n')}`);

        if (openDividends + soldDividends > 0 || openRealized + soldRealized !== 0) {
          sections.push(
            'Income and realised gains, all time:\n' +
              `- Dividends received ${money(openDividends + soldDividends)} ` +
              `(${money(openDividends)} from positions held, ${money(soldDividends)} from sold ones)\n` +
              `- Gains realised by selling ${money(openRealized + soldRealized)} ` +
              `(${money(openRealized)} from positions held, ${money(soldRealized)} from sold ones)`
          );
        }

        if (closed.length > 0) {
          sections.push(
            'Sold positions (held and sold out of):\n' +
              closed
                .map((position) => {
                  const name = position.displayName ? ` (${position.displayName})` : '';
                  const held = `held ${position.firstTradeDate} to ${position.closedDate}`;
                  if (position.missingFxRate) {
                    return `- ${position.ticker}${name}: ${held} — no exchange rate for ${position.currency ?? 'its currency'}, so no figures`;
                  }
                  const made = position.totalReturn ?? 0;
                  return (
                    `- ${position.ticker}${name}: ${held}, bought for ${money(position.bought ?? 0)}, ` +
                    `sold for ${money(position.proceeds ?? 0)}, realised ${money(position.realizedGain ?? 0)}, ` +
                    `dividends ${money(position.dividends ?? 0)}, made ${made >= 0 ? '' : '-'}${money(Math.abs(made))} in all`
                  );
                })
                .join('\n')
          );
        }

        sections.push(`Most recent trades:\n${recent.join('\n') || '(none)'}`);
        return ok(sections.join('\n\n'));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'list_trades',
    {
      title: 'Trades, dividends and fees in the trade log',
      description:
        'The trade log itself: every buy, sell, dividend and fee, newest first, with totals for what ' +
        'matched. get_portfolio only shows the ten latest, so use this for "what dividends did VUSA ' +
        'pay", "what did we buy this year", "show every sale", "how much did we put into VWCE". ' +
        'Dividends are listed with the amount they paid.',
      inputSchema: {
        ticker: z
          .string()
          .optional()
          .describe('One instrument, as "VUSA.DEX" or just "VUSA". Leave out for all of them.'),
        type: z.enum(['buy', 'sell', 'dividend', 'fee']).optional().describe('Only this kind of entry'),
        from: dateSchema.optional().describe('First day to include, YYYY-MM-DD'),
        to: dateSchema.optional().describe('Last day to include, YYYY-MM-DD'),
        limit: z.number().int().min(1).max(200).optional().describe('How many to list (default 40)'),
        ...journalSchema(caller)
      }
    },
    async ({ ticker, type, from, to, limit, journal }) => {
      try {
        const trades = await finance.listTrades(apiKey, tenantFor(caller, journal));

        const wanted = ticker?.trim().toUpperCase();
        const matching = trades
          .filter((trade) => {
            const held = trade.ticker.toUpperCase();
            if (wanted && held !== wanted && !held.startsWith(`${wanted}.`)) return false;
            if (type && trade.type !== type) return false;
            const day = trade.date.slice(0, 10);
            if (from && day < from) return false;
            if (to && day > to) return false;
            return true;
          })
          .sort((a, b) => b.date.localeCompare(a.date));

        if (matching.length === 0) return ok('No trades match that.');

        // Totals over everything that matched, not over the page shown: a
        // question about how much was paid out is about all of it.
        const sum = (kind: string, amount: (trade: (typeof matching)[number]) => number) =>
          matching.filter((trade) => trade.type === kind).reduce((acc, trade) => acc + amount(trade), 0);
        const countOf = (kind: string) => matching.filter((trade) => trade.type === kind).length;
        const parts: string[] = [];
        if (countOf('buy') > 0) {
          parts.push(
            `${countOf('buy')} buys for ${money(sum('buy', (t) => (t.quantity ?? 0) * (t.price ?? 0)))}`
          );
        }
        if (countOf('sell') > 0) {
          parts.push(
            `${countOf('sell')} sales for ${money(sum('sell', (t) => (t.quantity ?? 0) * (t.price ?? 0)))}`
          );
        }
        if (countOf('dividend') > 0) {
          parts.push(`${countOf('dividend')} dividends paying ${money(sum('dividend', (t) => t.amount ?? 0))}`);
        }
        if (countOf('fee') > 0) {
          parts.push(`${countOf('fee')} fees of ${money(sum('fee', (t) => t.amount ?? 0))}`);
        }

        const shown = matching.slice(0, limit ?? 40);
        const header =
          `${matching.length} matching: ${parts.join(', ')}.` +
          (shown.length < matching.length ? ` Showing the ${shown.length} most recent.` : '');
        return ok(`${header}\n${shown.map(describeTrade).join('\n')}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
}
