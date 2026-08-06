import React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, Alert, Chip } from '@mui/material';
import { CashflowSummary, Analytics } from '../../services/cashflowService';
import { formatCurrency, formatPct, formatPeriod } from '../../utils/numberUtils';

interface CashflowSummaryCardsProps {
  summary: CashflowSummary;
  /** Supplies the trailing window and its category figures. */
  analytics?: Analytics;
  currency?: string;
}

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/**
 * The headline cash-flow figures.
 *
 * Everything here is over the trailing twelve months and says so. An unlabelled
 * total invites the reader to assume it is this month or this year, and a
 * lifetime average of a decade of spending answers no question anyone asks.
 */
const CashflowSummaryCards: React.FC<CashflowSummaryCardsProps> = ({
  summary,
  analytics,
  currency = 'EUR'
}) => {
  const { growth } = summary;
  const money = (v: number) => formatCurrency(v, currency);

  const trailing = analytics?.trailing.current;
  const previous = analytics?.trailing.previous;
  const range = trailing
    ? `${formatPeriod(trailing.from)} – ${formatPeriod(trailing.to)}`
    : 'the last 12 months';

  // Categories are compared on the same trailing window as the totals, so the
  // per-month figure means the same thing in both places.
  const categories = (analytics?.categoryTrends || [])
    .filter((c) => !(analytics?.investmentCategories || []).includes(c.category))
    .slice(0, 10);
  const biggest = categories[0]?.perMonth || 0;

  const changeFrom = (now: number, before: number | undefined) =>
    before === undefined || before === 0 ? null : ((now - before) / before) * 100;

  const tiles = trailing
    ? [
        {
          label: 'Income',
          value: money(trailing.income),
          change: changeFrom(trailing.income, previous?.income),
          goodWhenUp: true
        },
        {
          label: 'Spending',
          value: money(trailing.consumption),
          sublabel:
            trailing.invested > 0
              ? `plus ${money(trailing.invested)} invested${
                  trailing.divested > 0 ? `, ${money(trailing.divested)} back out` : ''
                }`
              : undefined,
          change: changeFrom(trailing.consumption, previous?.consumption),
          goodWhenUp: false
        },
        {
          label: 'Kept',
          value: money(trailing.savings),
          sublabel: 'income less spending',
          change: changeFrom(trailing.savings, previous?.savings),
          goodWhenUp: true
        },
        {
          label: 'Savings rate',
          value: trailing.savingsRate === null ? '—' : formatPct(trailing.savingsRate),
          sublabel: trailing.savingsRate === null ? 'no income recorded' : 'of income kept',
          change: null,
          goodWhenUp: true
        }
      ]
    : [];

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Last 12 months</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {range}
          {previous ? ' · change is against the 12 months before' : ''}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3
        }}
      >
        {tiles.map((tile) => (
          <Card key={tile.label} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{tile.label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{tile.value}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, minHeight: 20 }}>
                {tile.change !== null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={formatPct(tile.change)}
                    color={
                      Math.abs(tile.change) < 0.05
                        ? 'default'
                        : (tile.change > 0) === tile.goodWhenUp
                          ? 'success'
                          : 'error'
                    }
                  />
                )}
                {tile.sublabel && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{tile.sublabel}</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Only shown once there is a real pair of check-ins to compare. A split
          against a month you have not filled in yet is noise. */}
      {growth && growth.complete && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Why net worth moved · {formatPeriod(growth.from)} → {formatPeriod(growth.to)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Net worth changed by {money(growth.netWorthChange)}. Splitting that between money you
              put aside and what the market did is the difference between saving well and investing
              well.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>You contributed</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{money(growth.contributions)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Market did</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: signColor(growth.marketGrowth) }}>
                  {growth.marketGrowth >= 0 ? '+' : ''}{money(growth.marketGrowth)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {growth && !growth.complete && (
        <Alert severity="info" sx={{ mb: 3 }}>
          The split between money saved and market movement needs a net-worth check-in for{' '}
          {formatPeriod(growth.from)} with transactions covering it. Add that month on the Net Worth
          page and it will appear here.
        </Alert>
      )}

      {categories.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Spending by category
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Average per month over the last 12 months
            </Typography>

            {categories.map((category) => (
              <Box key={category.category} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{category.category}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {money(category.perMonth)} / month
                  </Typography>
                </Box>
                {/* Bars are relative to the biggest category, so the shape of
                    spending reads at a glance without a budget to compare to. */}
                <LinearProgress
                  variant="determinate"
                  value={biggest > 0 ? (category.perMonth / biggest) * 100 : 0}
                  sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CashflowSummaryCards;
