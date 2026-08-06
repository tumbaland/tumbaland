import React from 'react';
import { Card, CardContent, Typography, Box, Button, LinearProgress, Tooltip } from '@mui/material';
import { AccountBalanceWallet, Link as LinkIcon } from '@mui/icons-material';
import { Link } from 'react-router';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency, formatPct } from '../utils/numberUtils';

interface CashflowCardProps {
  cashflow: NonNullable<DashboardData['cashflow']>;
  currency?: string;
}

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/**
 * The dashboard's answer to "why did net worth move?" — the split between money
 * saved and market movement, which neither the snapshot history nor the
 * holdings list can give on its own.
 */
const CashflowCard: React.FC<CashflowCardProps> = ({ cashflow, currency = 'EUR' }) => {
  const { latestMonth, averageSavingsRate, growth } = cashflow;
  const money = (v: number) => formatCurrency(v, currency);

  // Share of the change attributable to contributions, for the split bar. Only
  // meaningful when both parts push the same way — a month where savings went
  // in but the market fell has no sensible 0–100 split.
  const total = growth ? Math.abs(growth.contributions) + Math.abs(growth.marketGrowth) : 0;
  const contributionShare = total > 0 ? (Math.abs(growth!.contributions) / total) * 100 : 0;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AccountBalanceWallet sx={{ mr: 2, color: '#11998e' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Cash Flow</Typography>
        </Box>

        {latestMonth && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Saved · {latestMonth.month}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: signColor(latestMonth.savings) }}>
                {money(latestMonth.savings)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Savings rate</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {latestMonth.savingsRate === null ? '—' : formatPct(latestMonth.savingsRate)}
              </Typography>
            </Box>
            {averageSavingsRate !== null && (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>12-month average</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatPct(averageSavingsRate)}</Typography>
              </Box>
            )}
          </Box>
        )}

        {growth && (
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Net worth moved {money(growth.netWorthChange)} from {growth.from} to {growth.to}
            </Typography>

            <Tooltip
              title={
                growth.complete
                  ? `${money(growth.contributions)} contributed · ${money(growth.marketGrowth)} market`
                  : `No transactions recorded for ${growth.from}, so the split is not yet reliable`
              }
            >
              <LinearProgress
                variant="determinate"
                value={contributionShare}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  mb: 1.5,
                  bgcolor: 'action.hover',
                  opacity: growth.complete ? 1 : 0.5,
                  '& .MuiLinearProgress-bar': { bgcolor: '#11998e', borderRadius: 5 }
                }}
              />
            </Tooltip>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>You contributed</Typography>
                <Typography sx={{ fontWeight: 700 }}>{money(growth.contributions)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Market did</Typography>
                <Typography sx={{ fontWeight: 700, color: signColor(growth.marketGrowth) }}>
                  {growth.marketGrowth >= 0 ? '+' : ''}{money(growth.marketGrowth)}
                </Typography>
              </Box>
            </Box>

            {!growth.complete && (
              <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 1.5 }}>
                No transactions for {growth.from} — the whole change is shown as market movement.
              </Typography>
            )}
          </Box>
        )}

        <Button
          component={Link}
          to="/cash-flow"
          size="small"
          startIcon={<LinkIcon />}
          sx={{ mt: 2 }}
        >
          Open cash flow
        </Button>
      </CardContent>
    </Card>
  );
};

export default CashflowCard;
