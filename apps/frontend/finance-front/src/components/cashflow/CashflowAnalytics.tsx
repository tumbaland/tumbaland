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
import { Analytics, CategoryTrend } from '../../services/cashflowService';
import { formatCurrency, formatPct, formatPeriod, formatCompactCurrency } from '../../utils/numberUtils';
import { movingAverage, profile } from '../../utils/trend';
import Sparkline from './Sparkline';

interface CashflowAnalyticsProps {
  analytics: Analytics;
}

type Granularity = 'month' | 'year';

const INCOME_COLOR = '#11998e';
const EXPENSE_COLOR = '#e05260';
const TREND_COLOR = '#8b5cf6';
const INVEST_COLOR = '#667eea';

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/**
 * A percentage floor for the movers list.
 *
 * Below this the base is too small for a percentage to mean anything: a
 * category that went from 6 € to 710 € is not up 717%, it is a category that
 * did not exist last year and now costs 700 €. The euro change is always the
 * headline; the percentage is a footnote it has to earn.
 */
const PERCENT_FLOOR = 250;

const moverNote = (c: CategoryTrend): string | null => {
  if (c.previous === 0) return 'new';
  if (c.latest === 0) return 'stopped';
  if (c.previous < PERCENT_FLOOR) return 'from a small base';
  return c.changePct === null ? null : formatPct(c.changePct);
};

const CashflowAnalytics: React.FC<CashflowAnalyticsProps> = ({ analytics }) => {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const currency = analytics.currency || 'EUR';
  const money = (v: number) => formatCurrency(v, currency);

  // Comparisons run on the trailing twelve months rather than calendar years:
  // in March, "this year" is two months against twelve, and every category
  // would look like it had collapsed.
  const trailing = analytics.trailing;
  const trailingLabel = trailing?.previous
    ? `${formatPeriod(trailing.current.from)}–${formatPeriod(trailing.current.to)} against the 12 months before`
    : `${formatPeriod(trailing?.current.from || '')}–${formatPeriod(trailing?.current.to || '')}`;

  // Spending means consumption, not everything that left the account. Plotting
  // gross outflow under a "Spending" label made a year that bought 122k of ETFs
  // read as 11k a month of spending.
  const series = useMemo(() => {
    if (granularity === 'year') {
      return analytics.years.map((y) => ({
        period: String(y.year),
        income: y.income,
        expense: y.consumption,
        invested: y.invested
      }));
    }
    return analytics.months.map((m) => ({
      period: m.period,
      income: m.income,
      expense: m.consumption,
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
  const investments = series.map((p) => p.invested);
  const hasInvesting = investments.some((v) => v > 0);

  // A year of months smooths the seasonality out; over years there is nothing
  // seasonal to smooth, so a 3-period window just shows direction.
  const window = granularity === 'month' ? 12 : 3;
  const incomeTrend = useMemo(() => movingAverage(incomes, window), [incomes, window]);
  const expenseTrend = useMemo(() => movingAverage(expenses, window), [expenses, window]);

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
  const profileWindow = granularity === 'month' ? 12 : 5;
  const expenseProfile = useMemo(() => profile(expenses, profileWindow), [expenses, profileWindow]);
  const incomeProfile = useMemo(() => profile(incomes, profileWindow), [incomes, profileWindow]);
  const profiled = labels.slice(-profileWindow);
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
                  middle of the last {values.length} {unit}s · {profileRange}
                </Typography>

                <Sparkline
                  values={values}
                  color={card.color}
                  label={`${card.label} over the last ${values.length} ${unit}s, ending at ${money(latest)}`}
                />

                <Box sx={{ mt: 1, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Quietest {money(low)} · heaviest {money(high)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tone }}>
                    {profiled.length > 0 && `${formatPeriod(profiled[profiled.length - 1])}: `}
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
          <Typography variant="subtitle2">What each {unit} was</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Spending is what was consumed. Money put into investments, savings or a
            pension is shown separately — it left the account but was not spent.
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <BarChart
              className="chart-earned-spent"
              height={280}
              xAxis={[{ data: labels, scaleType: 'band', valueFormatter: periodLabel }]}
              yAxis={[{ valueFormatter: axisMoney }]}
              series={[
                { data: incomes, label: 'Income', color: INCOME_COLOR, valueFormatter: chartMoney },
                { data: expenses, label: 'Spending', color: EXPENSE_COLOR, valueFormatter: chartMoney }
              ]}
              margin={{ left: 70 }}
            />
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

      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2">Where it is heading</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {window}-{unit} trailing average, which smooths out one-off bills
          </Typography>
          <Box sx={{ overflowX: 'auto', mt: 1 }}>
            <LineChart
              height={280}
              xAxis={[{ data: labels, scaleType: 'point', valueFormatter: periodLabel }]}
              yAxis={[{ valueFormatter: axisMoney }]}
              series={[
                {
                  data: incomeTrend,
                  label: 'Income average',
                  color: INCOME_COLOR,
                  showMark: false,
                  valueFormatter: chartMoney
                },
                {
                  data: expenseTrend,
                  label: 'Spending average',
                  color: TREND_COLOR,
                  showMark: false,
                  valueFormatter: chartMoney
                }
              ]}
              margin={{ left: 70 }}
            />
          </Box>
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

      {analytics.categoryTrends.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Biggest movers in spending
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {trailingLabel}
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              {[...analytics.categoryTrends]
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                .slice(0, 8)
                .map((c) => (
                  <Box
                    key={c.category}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
                  >
                    <Typography variant="body2">{c.category}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {money(c.previous)} → {money(c.latest)}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${c.change >= 0 ? '+' : '−'}${money(Math.abs(c.change))}`}
                        color={c.change > 0 ? 'error' : c.change < 0 ? 'success' : 'default'}
                        variant="outlined"
                      />
                      {moverNote(c) && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {moverNote(c)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CashflowAnalytics;
