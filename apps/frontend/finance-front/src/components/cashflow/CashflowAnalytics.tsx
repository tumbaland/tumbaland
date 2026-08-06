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
import { formatCurrency, formatPct, formatPeriod, formatCompactCurrency } from '../../utils/numberUtils';
import { movingAverage, linearTrend, halfOverHalfChange } from '../../utils/trend';

interface CashflowAnalyticsProps {
  analytics: Analytics;
}

type Granularity = 'month' | 'year';

const INCOME_COLOR = '#11998e';
const EXPENSE_COLOR = '#e05260';
const TREND_COLOR = '#8b5cf6';

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');
/** For spending, going up is the bad direction — the opposite of income. */
const spendColor = (v: number) => (v > 0 ? 'error.main' : v < 0 ? 'success.main' : 'text.secondary');

const CashflowAnalytics: React.FC<CashflowAnalyticsProps> = ({ analytics }) => {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const currency = analytics.currency || 'EUR';
  const money = (v: number) => formatCurrency(v, currency);

  const series = useMemo(() => {
    if (granularity === 'year') {
      return analytics.years.map((y) => ({
        period: String(y.year),
        income: y.income,
        expense: y.expense
      }));
    }
    return analytics.months.map((m) => ({
      period: m.period,
      income: m.income,
      expense: m.expense
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

  // A year of months smooths the seasonality out; over years there is nothing
  // seasonal to smooth, so a 3-period window just shows direction.
  const window = granularity === 'month' ? 12 : 3;
  const incomeTrend = useMemo(() => movingAverage(incomes, window), [incomes, window]);
  const expenseTrend = useMemo(() => movingAverage(expenses, window), [expenses, window]);

  const expenseSlope = linearTrend(expenses);
  const incomeSlope = linearTrend(incomes);
  const expenseShift = halfOverHalfChange(expenses);
  const incomeShift = halfOverHalfChange(incomes);
  const unit = granularity === 'month' ? 'month' : 'year';

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
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Spending trend
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: spendColor(expenseSlope) }}>
              {expenseSlope >= 0 ? '+' : '−'}{money(Math.abs(expenseSlope))} / {unit}
            </Typography>
            {expenseShift !== null && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {formatPct(expenseShift)} comparing the recent half with the earlier half
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Income trend
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: signColor(incomeSlope) }}>
              {incomeSlope >= 0 ? '+' : '−'}{money(Math.abs(incomeSlope))} / {unit}
            </Typography>
            {incomeShift !== null && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {formatPct(incomeShift)} comparing the recent half with the earlier half
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            What each {unit} was
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <BarChart
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
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Year on year
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Year</TableCell>
                    <TableCell align="right">Income</TableCell>
                    <TableCell align="right">vs prev</TableCell>
                    <TableCell align="right">Spending</TableCell>
                    <TableCell align="right">vs prev</TableCell>
                    <TableCell align="right">Invested</TableCell>
                    <TableCell align="right">Saved</TableCell>
                    <TableCell align="right">Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...analytics.years].reverse().map((y) => (
                    <TableRow key={y.year} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{y.year}</TableCell>
                      <TableCell align="right">{money(y.income)}</TableCell>
                      <TableCell align="right" sx={{ color: signColor(y.incomeChange ?? 0) }}>
                        {y.incomeChangePct === null ? '—' : formatPct(y.incomeChangePct)}
                      </TableCell>
                      <TableCell align="right">{money(y.consumption)}</TableCell>
                      <TableCell align="right" sx={{ color: spendColor(y.expenseChange ?? 0) }}>
                        {y.expenseChangePct === null ? '—' : formatPct(y.expenseChangePct)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        {y.invested ? money(y.invested) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: signColor(y.savings) }}>
                        {money(y.savings)}
                      </TableCell>
                      <TableCell align="right">
                        {y.savingsRate === null ? '—' : formatPct(y.savingsRate)}
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
              Latest year against the one before
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
                        label={
                          c.changePct === null
                            ? `${c.change >= 0 ? '+' : ''}${money(c.change)}`
                            : formatPct(c.changePct)
                        }
                        color={c.change > 0 ? 'error' : c.change < 0 ? 'success' : 'default'}
                        variant="outlined"
                      />
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
