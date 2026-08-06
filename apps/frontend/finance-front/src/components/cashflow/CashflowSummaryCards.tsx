import React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress, Tooltip, Alert } from '@mui/material';
import { CashflowSummary } from '../../services/cashflowService';
import { formatCurrency, formatPct } from '../../utils/numberUtils';

interface CashflowSummaryCardsProps {
  summary: CashflowSummary;
  currency?: string;
}

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/**
 * The headline cash-flow figures: what came in, what went out, what was kept,
 * and — the number the whole layer exists for — how much of the net-worth
 * change was money saved rather than market movement.
 */
const CashflowSummaryCards: React.FC<CashflowSummaryCardsProps> = ({ summary, currency = 'EUR' }) => {
  const { totals, growth, categories } = summary;
  const money = (v: number) => formatCurrency(v, currency);
  const overBudget = categories.filter((c) => c.variance !== null && c.variance > 0);

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3
        }}
      >
        {[
          { label: 'Income', value: money(totals.income), color: 'success.main' },
          { label: 'Expenses', value: money(totals.expense), color: 'error.main' },
          { label: 'Saved', value: money(totals.savings), color: signColor(totals.savings) },
          {
            label: 'Savings rate',
            value: totals.savingsRate === null ? '—' : formatPct(totals.savingsRate),
            sublabel: totals.savingsRate === null ? 'no income recorded' : undefined,
            color: totals.savingsRate === null ? 'text.secondary' : signColor(totals.savingsRate)
          }
        ].map((tile) => (
          <Card key={tile.label} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{tile.label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tile.color }}>{tile.value}</Typography>
              {tile.sublabel && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{tile.sublabel}</Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      {growth && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Why net worth moved · {growth.from} → {growth.to}
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

            {!growth.complete && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No transactions recorded for {growth.from}, so the whole change is attributed to the
                market. Add that month&apos;s income and expenses for a real split.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {categories.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Spending by category
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Monthly average across the months that have transactions
              {overBudget.length > 0 && ` · ${overBudget.length} over budget`}
            </Typography>

            {categories.map((category) => {
              const share = category.budget ? Math.min(100, (category.spent / category.budget) * 100) : 0;
              const over = category.variance !== null && category.variance > 0;
              return (
                <Box key={category.category} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{category.category}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: over ? 'error.main' : 'text.primary' }}>
                      {money(category.spent)}
                      {category.budget !== null && (
                        <Tooltip title={over ? `${money(category.variance || 0)} over` : 'Within budget'}>
                          <span style={{ opacity: 0.7 }}> / {money(category.budget)}</span>
                        </Tooltip>
                      )}
                    </Typography>
                  </Box>
                  {category.budget !== null && (
                    <LinearProgress
                      variant="determinate"
                      value={share}
                      color={over ? 'error' : 'primary'}
                      sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
                    />
                  )}
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CashflowSummaryCards;
