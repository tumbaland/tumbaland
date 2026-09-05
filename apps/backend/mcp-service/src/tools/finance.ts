import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { finance, Growth, PeriodTotals, Transaction } from '../finance';
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

/**
 * A total, to the nearest unit.
 *
 * Cents belong on a payment, where they are what the bank charged, and nowhere
 * near a five-figure aggregate. `510116.00` and `510116` say the same thing and
 * the first one invites the model to quote a precision the figure never had —
 * a net worth built from a daily price job is not accurate to the cent.
 */
const total = (value: number): string => Math.round(value).toLocaleString('en-US');

/** A percentage with its sign, or nothing when there was no base to compare against. */
const signed = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/** The same, parenthesised, for trailing a figure it qualifies. */
const pct = (value: number | null | undefined): string => {
  const rendered = signed(value);
  return rendered ? ` (${rendered})` : '';
};

/** A change, with its direction said in words rather than left to a minus sign. */
const moved = (value: number, percentage?: number | null): string =>
  `${value >= 0 ? 'up' : 'down'} ${total(Math.abs(value))}${pct(percentage)}`;

/**
 * One period, as a sentence.
 *
 * Income, spending and the split inside the spending: money consumed against
 * money moved into an asset. Keeping those apart is the whole point of the
 * period totals — spending 65,688 of which 39,021 went into investments is not
 * the same story as spending 65,688, and a model given only the total tells the
 * wrong one.
 */
const describePeriod = (period: PeriodTotals): string => {
  const window = period.from && period.to ? `${period.from} to ${period.to}` : 'the period';
  const rate = period.savingsRate === null || period.savingsRate === undefined
    ? ''
    : ` (${period.savingsRate.toFixed(0)}% of income)`;
  return (
    `${window}: income ${total(period.income)}, out ${total(period.expense)} — ` +
    `${total(period.consumption)} consumed, ${total(period.invested)} into assets. ` +
    `Saved ${total(period.savings)}${rate}.`
  );
};

/**
 * Why net worth moved, when the split is trustworthy.
 *
 * An incomplete split is left out rather than shown with a caveat: the numbers
 * do not add up in that case, and a model handed two figures that disagree with
 * their own total will reconcile them by inventing a reason.
 */
const describeGrowth = (growth: Growth | null | undefined): string | null => {
  if (!growth || growth.complete === false) return null;
  const window = growth.from && growth.to ? ` between ${growth.from} and ${growth.to}` : '';
  return (
    `Net worth moved ${total(growth.netWorthChange)}${window}: ` +
    `${total(growth.marketGrowth)} from the market, ${total(growth.contributions)} from contributions.`
  );
};

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
        'What everything adds up to right now, how it has moved over the last month and year, how ' +
        'it is split across asset classes, and what it was worth at each year end. Use for "how ' +
        'are we doing", "what are we worth", "how much has it grown".',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const dashboard = await finance.getDashboard(apiKey, groupIdFor(resolveJournal(caller, journal)));
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
        const lines: string[] = [];

        if (summary.months.length > 0) {
          lines.push(
            'Month by month:',
            ...summary.months.map((month) => {
              const rate =
                month.savingsRate === null || month.savingsRate === undefined
                  ? ''
                  : ` (${month.savingsRate.toFixed(0)}%)`;
              return (
                `- ${month.month}: in ${total(month.income)}, out ${total(month.expense)}, ` +
                `saved ${total(month.savings)}${rate}`
              );
            })
          );
        }

        if (summary.categories.length > 0) {
          lines.push(
            '',
            // Said explicitly because the number is an average, not a total, and
            // a model that reads it as a total is out by the length of the window.
            'Spending by category, per month on average:',
            ...summary.categories.map((entry) => `- ${entry.category} ${total(entry.spent)}`)
          );
        }

        if (summary.totals) {
          const rate =
            summary.totals.savingsRate === null || summary.totals.savingsRate === undefined
              ? ''
              : ` (${summary.totals.savingsRate.toFixed(0)}% of income)`;
          lines.push(
            '',
            `Across the window: income ${total(summary.totals.income)}, out ` +
              `${total(summary.totals.expense)}, saved ${total(summary.totals.savings)}${rate}.`
          );
        }

        const growth = describeGrowth(summary.growthTrailing);
        if (growth) lines.push(growth);

        return ok(lines.length > 0 ? lines.join('\n') : 'Nothing is recorded for that window.');
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
        'get_spending cannot answer because it only covers a recent window. For the month-by-month ' +
        'figures inside a window, call get_spending instead.',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const analytics = await finance.getAnalytics(
          apiKey,
          groupIdFor(resolveJournal(caller, journal))
        );
        const currency = analytics.currency ? ` (${analytics.currency})` : '';
        const lines: string[] = [];

        if (analytics.years.length > 0) {
          lines.push(
            `Income and spending by year${currency}:`,
            ...analytics.years.map((year) => {
              const rate =
                year.savingsRate === null || year.savingsRate === undefined
                  ? ''
                  : ` (${year.savingsRate.toFixed(0)}%)`;
              // A short year is marked, because its totals are smaller than a
              // full year's for a reason that is not a trend. "Months of data",
              // not "months so far": the flag means fewer than twelve months
              // were recorded, which is true of the year in progress and just as
              // true of a sparse year a decade ago.
              const partial = year.partial ? ` (${year.months ?? 0} months of data)` : '';
              const against =
                year.incomeChangePct === null || year.incomeChangePct === undefined
                  ? ''
                  : `; against the year before, income ${signed(year.incomeChangePct)}, spending ${signed(year.expenseChangePct)}`;
              return (
                `- ${year.year}${partial}: in ${total(year.income)}, out ${total(year.expense)} ` +
                `(${total(year.consumption)} consumed, ${total(year.invested)} into assets), ` +
                `saved ${total(year.savings)}${rate}${against}`
              );
            })
          );
        }

        if (analytics.trailing) {
          lines.push('', `Last 12 months, ${describePeriod(analytics.trailing.current)}`);
          if (analytics.trailing.previous) {
            lines.push(`The 12 before, ${describePeriod(analytics.trailing.previous)}`);
          }
        }

        if (analytics.categoryTrends.length > 0) {
          lines.push(
            '',
            'Spending by category over the last 12 months, against the 12 before:',
            // A category at zero that was also at zero before is a row saying
            // nothing. One that fell to zero is not, and stays.
            ...analytics.categoryTrends
              .filter((trend) => trend.latest !== 0 || (trend.change ?? 0) !== 0)
              .map((trend) => {
                const change =
                  trend.change === undefined ? '' : `, ${moved(trend.change, trend.changePct)}`;
                return `- ${trend.category} ${total(trend.latest)}${change}`;
              })
          );
        }

        if (analytics.incomeSources.length > 0) {
          lines.push(
            '',
            'Income by source, all time:',
            ...analytics.incomeSources.map((source) => {
              // The latest year it earned anything, rather than the whole
              // per-year map: a source that stopped in 2021 is a different
              // answer from one still paying, and one figure says which.
              const years = Object.keys(source.byYear ?? {}).sort();
              const latest = years[years.length - 1];
              const recent =
                latest && source.byYear ? `, ${total(source.byYear[latest]!)} in ${latest}` : '';
              return `- ${source.category} ${total(source.total)}${recent}`;
            })
          );
        }

        if (analytics.investmentCategories.length > 0) {
          lines.push(
            '',
            `Counted as money moved into an asset rather than spent: ${analytics.investmentCategories.join(', ')}.`
          );
        }

        // The endpoint also carries every month since the first transaction.
        // Said rather than sent: the model that wants it has a tool for it, and
        // a hundred and twenty monthly points nobody asked for is five thousand
        // tokens carried through the rest of the conversation.
        lines.push('', 'For month-by-month figures, call get_spending.');

        return ok(lines.join('\n'));
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

        if (recurring.payments.length === 0) {
          return ok('Nothing in that window repeats often enough to call a subscription.');
        }

        const window =
          recurring.from && recurring.to ? ` between ${recurring.from} and ${recurring.to}` : '';
        const lapsed = recurring.lapsedCount
          ? `, ${recurring.lapsedCount} of which have stopped arriving`
          : '';
        const header =
          `${recurring.payments.length} recurring payments${window}: ` +
          `${total(recurring.monthlyTotal)} a month, ${total(recurring.yearlyTotal)} a year${lapsed}.`;

        const lines = recurring.payments.map((payment) => {
          const category = payment.category ? ` (${payment.category})` : '';
          const cadence = payment.cadence ? ` ${payment.cadence}` : '';
          // The monthly equivalent only when it differs from the charge, so a
          // plain monthly subscription is not given the same number twice.
          const equivalent =
            payment.monthlyEquivalent !== undefined &&
            Math.round(payment.monthlyEquivalent) !== Math.round(payment.amount)
              ? `, ${money(payment.monthlyEquivalent)} a month`
              : '';
          const last = payment.lastCharge ? `, last ${payment.lastCharge}` : '';
          const late = payment.daysUntilNext === undefined ? 0 : Math.abs(payment.daysUntilNext);
          const overdue =
            payment.daysUntilNext !== undefined && payment.daysUntilNext < 0
              ? `, ${late} day${late === 1 ? '' : 's'} overdue`
              : payment.nextExpected
                ? `, next ${payment.nextExpected}`
                : '';
          const change = payment.priceChange
            ? `, price went from ${money(payment.priceChange.previousAmount)} to ${money(payment.priceChange.currentAmount)}`
            : '';
          return (
            `- ${payment.merchant}${category}: ${money(payment.amount)}${cadence}${equivalent}` +
            `${payment.status ? ` — ${payment.status}` : ''}${last}${overdue}${change}`
          );
        });

        return ok(`${header}\n${lines.join('\n')}`);
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
