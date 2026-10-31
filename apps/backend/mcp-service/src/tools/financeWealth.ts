import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { finance } from '../finance';
import { Caller, explain, journalSchema, ok, tenantFor } from './module';
import { describeGrowth, describePeriod, money, moved, total } from './financeFormat';

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
          `Portfolio worth ${money(value)} ${currency} against ${money(cost)} invested — ` +
          `${gain >= 0 ? 'up' : 'down'} ${money(Math.abs(gain))} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)` +
          // Prices come from a daily job, so the date matters: quoting a stale
          // figure as "now" is the one way this can mislead.
          (asOf ? `, at prices from ${asOf.slice(0, 10)}` : '') +
          '.';

        const recent = trades.slice(0, 10).map((trade) => {
          const day = trade.date.slice(0, 10);
          // By type, not by which fields are present: the API sends quantity and
          // price as 0 on a dividend or fee, so a presence check printed every
          // payout as "0 at 0.00" and hid the amount.
          const size =
            trade.type === 'buy' || trade.type === 'sell'
              ? `${trade.quantity ?? 0} at ${money(trade.price ?? 0)}`
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
