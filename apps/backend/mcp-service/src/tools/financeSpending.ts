import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { finance } from '../finance';
import { Caller, dateSchema, explain, journalSchema, ok, tenantFor } from './module';
import { count, describeGrowth, describePeriod, describeTransaction, money, moved, signed, total } from './financeFormat';

/** Where the money went: by month, by year, by payment, and on a schedule. */
export function registerSpendingTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;

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
        const groupId = tenantFor(caller, journal);
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
        const groupId = tenantFor(caller, journal);
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
        const analytics = await finance.getAnalytics(apiKey, tenantFor(caller, journal));
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
        const groupId = tenantFor(caller, journal);
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
}
