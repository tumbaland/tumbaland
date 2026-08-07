import React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, Chip } from '@mui/material';
import { CashflowSummary, Analytics } from '../../services/cashflowService';
import { formatCurrency, formatPct, formatPeriod } from '../../utils/numberUtils';
import NetWorthMovement from './NetWorthMovement';

interface CashflowSummaryCardsProps {
  summary: CashflowSummary;
  /** Supplies the trailing window and its category figures. */
  analytics?: Analytics;
  currency?: string;
}

/**
 * The headline cash-flow figures.
 *
 * Everything here is over the trailing twelve months and says so, the net-worth
 * split below included. An unlabelled total invites the reader to assume it is
 * this month or this year, and a lifetime average of a decade of spending
 * answers no question anyone asks.
 */
const CashflowSummaryCards: React.FC<CashflowSummaryCardsProps> = ({
  summary,
  analytics,
  currency = 'EUR'
}) => {
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

  // Every tile reads the same way down the row: what it measures, the total
  // over the window, how it moved against the window before, and one line of
  // plain English. Tiles that skipped a part made the row impossible to scan.
  const tiles = trailing
    ? [
        {
          label: 'Total income',
          value: money(trailing.income),
          sublabel: 'Everything that came in',
          change: changeFrom(trailing.income, previous?.income),
          goodWhenUp: true
        },
        {
          label: 'Total spending',
          value: money(trailing.consumption),
          sublabel: 'What was consumed, not what left the account',
          // Investing left the account but bought an asset, so it sits beside
          // spending rather than inside it.
          badge:
            trailing.invested > 0
              ? `${money(trailing.invested)} invested${
                  trailing.divested > 0 ? `, ${money(trailing.divested)} back out` : ''
                }`
              : undefined,
          change: changeFrom(trailing.consumption, previous?.consumption),
          goodWhenUp: false
        },
        {
          label: 'Cash kept',
          value: money(trailing.savings),
          sublabel: 'Income minus spending',
          change: changeFrom(trailing.savings, previous?.savings),
          goodWhenUp: true
        },
        {
          label: 'Savings rate',
          value: trailing.savingsRate === null ? '—' : formatPct(trailing.savingsRate),
          sublabel: trailing.savingsRate === null ? 'No income recorded' : 'Share of income kept',
          change: null,
          goodWhenUp: true
        }
      ]
    : [];

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>12-month summary</Typography>
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
              {/* Fixed slot for the comparison, so the four subtexts line up
                  across the row whether or not a tile has one. */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.75, minHeight: 26 }}>
                {tile.change !== null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    title="Against the 12 months before"
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
                {tile.badge && <Chip size="small" variant="outlined" label={tile.badge} />}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{tile.sublabel}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Same scope as the figures above by default: a twelve-month summary
          followed by a one-month bridge read as one story and were not. */}
      <NetWorthMovement
        trailing={summary.growthTrailing}
        monthly={summary.growth}
        currency={currency}
      />


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
