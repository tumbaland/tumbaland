import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { Analytics } from '../../services/cashflowService';
import { formatCurrency, formatPeriod, formatCompactCurrency } from '../../utils/numberUtils';
import { profile } from '../../utils/trend';
import Sparkline from './Sparkline';

interface CashflowAnalyticsProps {
  analytics: Analytics;
}

type Granularity = 'month' | 'year';

const INCOME_COLOR = '#11998e';
const EXPENSE_COLOR = '#e05260';
const NET_COLOR = '#8b5cf6';
const INVEST_COLOR = '#667eea';

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/** The period that has not finished yet, in the key format the series uses. */
const periodInProgress = (granularity: Granularity): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  return granularity === 'year'
    ? String(year)
    : `${year}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const CashflowAnalytics: React.FC<CashflowAnalyticsProps> = ({ analytics }) => {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const currency = analytics.currency || 'EUR';
  const money = (v: number) => formatCurrency(v, currency);

  // Spending means consumption, not everything that left the account. Plotting
  // gross outflow under a "Spending" label made a year that bought 122k of ETFs
  // read as 11k a month of spending.
  const series = useMemo(() => {
    if (granularity === 'year') {
      return analytics.years.map((y) => ({
        period: String(y.year),
        income: y.income,
        expense: y.consumption,
        net: y.savings,
        invested: y.invested
      }));
    }

    return analytics.months.map((m) => ({
      period: m.period,
      income: m.income,
      expense: m.consumption,
      net: m.savings,
      invested: m.invested
    }));
  }, [analytics, granularity]);

  const labels = series.map((p) => p.period);
  // The tooltip header and the axis ticks both come from here, so a month reads
  // as "Jul 2026" rather than as the raw key.
  const periodLabel = (value: string) => formatPeriod(value);
  // Amounts are whole euros everywhere on the charts — a chart is not the place
  // to read cents, and three decimals on an axis is unreadable.
  const chartMoney = (value: number | null) => (value === null ? '' : formatCurrency(value, currency));
  const axisMoney = (value: number | null) => (value === null ? '' : formatCompactCurrency(value, currency));
  const incomes = series.map((p) => p.income);
  const expenses = series.map((p) => p.expense);
  const nets = series.map((p) => p.net);
  const investments = series.map((p) => p.invested);
  const hasInvesting = investments.some((v) => v > 0);

  const unit = granularity === 'month' ? 'month' : 'year';

  /**
   * What a normal period looks like, over the last twelve of them.
   *
   * This replaced a least-squares slope, a half-against-half percentage and a
   * latest-against-previous step. All three were arithmetically right and none
   * survived contact with the data: the slope averaged a student decade with a
   * salaried one into "+15 € / month", and the step compared a finished month
   * against a week of the current one and reported -96%.
   */
  const profileWindow = granularity === 'year' ? 5 : 12;

  /**
   * Everything except the period in progress.
   *
   * A month that is seven days old has neither its salary nor most of its
   * spending in it yet. Left in, it became the quietest month on record, pulled
   * the median down with it, and made the comparison read "121 €, 1377 € below
   * typical" — which says nothing about spending and everything about the date.
   */
  const complete =
    labels[labels.length - 1] === periodInProgress(granularity) ? series.length - 1 : series.length;
  const finishedExpenses = expenses.slice(0, complete);
  const finishedIncomes = incomes.slice(0, complete);
  const finishedLabels = labels.slice(0, complete);

  const expenseProfile = useMemo(
    () => profile(finishedExpenses, profileWindow),
    [finishedExpenses, profileWindow]
  );
  const incomeProfile = useMemo(
    () => profile(finishedIncomes, profileWindow),
    [finishedIncomes, profileWindow]
  );
  const profiled = finishedLabels.slice(-profileWindow);
  const profileRange = profiled.length
    ? `${formatPeriod(profiled[0])} – ${formatPeriod(profiled[profiled.length - 1])}`
    : '';

  if (series.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Income and spending over time
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={granularity}
          onChange={(_, next: Granularity | null) => next && setGranularity(next)}
        >
          <ToggleButton value="month">Monthly</ToggleButton>
          <ToggleButton value="year">Yearly</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 2
        }}
      >
        {[
          {
            label: 'Spending',
            profile: expenseProfile,
            color: EXPENSE_COLOR,
            goodWhenUp: false
          },
          {
            label: 'Income',
            profile: incomeProfile,
            color: INCOME_COLOR,
            goodWhenUp: true
          }
        ].map((card) => {
          if (!card.profile) return null;
          const { median, low, high, latest, values } = card.profile;
          // Against the middle month rather than the one before it: "was last
          // month normal" is answerable, "was last month bigger than the month
          // before" is noise on a series this jumpy.
          const gap = latest - median;
          const direction = gap > 0 ? 'above' : gap < 0 ? 'below' : 'right on';
          const tone = gap === 0 ? 'text.secondary' : (gap > 0) === card.goodWhenUp ? 'success.main' : 'error.main';

          return (
            <Card key={card.label} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {card.label} — a typical {unit}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{money(median)}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  middle of the last {values.length} full {unit}s · {profileRange}
                </Typography>

                <Sparkline
                  points={values.map((value, i) => ({
                    label: formatPeriod(profiled[i] ?? ''),
                    value
                  }))}
                  color={card.color}
                  format={money}
                  label={`${card.label} over the last ${values.length} ${unit}s, ending at ${money(latest)}`}
                />

                <Box sx={{ mt: 1, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Quietest {money(low)} · heaviest {money(high)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tone }}>
                    {`Last full ${unit},`}
                    {profiled.length > 0 && ` ${formatPeriod(profiled[profiled.length - 1])}`}:{' '}
                    {money(latest)}
                    {gap === 0 ? ' — right on typical' : ` — ${money(Math.abs(gap))} ${direction} typical`}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2">
            {granularity === 'month' ? 'Every month, as it happened' : `What each ${unit} was`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Spending is what was consumed. Money put into investments, savings or a
            pension is shown separately — it left the account but was not spent.
            {granularity === 'month' &&
              ' Exact figures, not an average: hover a month for its income, spending and what was kept.'}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            {/* Months are drawn as a line and marked point by point. The bars
                that were here made twelve years of months an unreadable comb,
                and the smoothed version that fixed it hid the actual figure for
                any given month — which is the one thing this chart is asked
                for. Years are few enough that bars still read cleanly. */}
            {granularity === 'month' ? (
              <LineChart
                className="chart-earned-spent"
                height={280}
                xAxis={[{ data: labels, scaleType: 'point', valueFormatter: periodLabel }]}
                yAxis={[{ valueFormatter: axisMoney }]}
                series={[
                  { data: incomes, label: 'Income', color: INCOME_COLOR, valueFormatter: chartMoney },
                  { data: expenses, label: 'Spending', color: EXPENSE_COLOR, valueFormatter: chartMoney },
                  { data: nets, label: 'Net cash flow', color: NET_COLOR, valueFormatter: chartMoney }
                ]}
                margin={{ left: 70 }}
              />
            ) : (
              <BarChart
                className="chart-earned-spent"
                height={280}
                xAxis={[{ data: labels, scaleType: 'band', valueFormatter: periodLabel }]}
                yAxis={[{ valueFormatter: axisMoney }]}
                series={[
                  { data: incomes, label: 'Income', color: INCOME_COLOR, valueFormatter: chartMoney },
                  { data: expenses, label: 'Spending', color: EXPENSE_COLOR, valueFormatter: chartMoney },
                  { data: nets, label: 'Net cash flow', color: NET_COLOR, valueFormatter: chartMoney }
                ]}
                margin={{ left: 70 }}
              />
            )}
          </Box>

          {/* Investing runs several times larger than a month's spending — a
              122k year of ETF buying on the same axis flattens income and
              spending into a strip along the bottom, which is the comparison
              this chart exists for. Its own axis below keeps both readable
              without pretending two different scales are one. */}
          {hasInvesting && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Invested — same {unit}s, its own scale
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <BarChart
                  className="chart-invested"
                  height={160}
                  xAxis={[{ data: labels, scaleType: 'band', valueFormatter: periodLabel }]}
                  yAxis={[{ valueFormatter: axisMoney }]}
                  series={[
                    { data: investments, label: 'Invested', color: INVEST_COLOR, valueFormatter: chartMoney }
                  ]}
                  margin={{ left: 70 }}
                />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {analytics.years.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2">Year on year</Typography>
            {/* No percentage columns. A year-over-year percentage is only
                meaningful when both years are complete and neither base is
                unusually small, and here neither holds: the current year is
                part-imported, and a year whose income landed mostly as capital
                returning makes the next year read as +266%. The euro figures
                read down the column without a false precision on top. */}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              Amounts only — a part year against a full one is not a comparison worth
              putting a percentage on.
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Year</TableCell>
                    <TableCell align="right">Income</TableCell>
                    <TableCell align="right">Spending</TableCell>
                    <TableCell align="right">Invested</TableCell>
                    <TableCell align="right">Returned</TableCell>
                    <TableCell align="right">Saved</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...analytics.years].reverse().map((y) => (
                    <TableRow key={y.year} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {y.year}
                        {y.partial && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${y.months} mo`}
                            sx={{ ml: 1 }}
                            title="Part year — not comparable with a full one"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">{money(y.income)}</TableCell>
                      <TableCell align="right">{money(y.consumption)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        {y.invested ? money(y.invested) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        {y.divested ? money(y.divested) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: signColor(y.savings) }}>
                        {money(y.savings)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

    </Box>
  );
};

export default CashflowAnalytics;
