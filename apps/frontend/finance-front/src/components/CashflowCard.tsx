import React from 'react';
import { Card, CardContent, Typography, Box, Button, LinearProgress, Tooltip, Chip } from '@mui/material';
import { AccountBalanceWallet, ArrowForward } from '@mui/icons-material';
import { Link } from 'react-router';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency, formatPct, formatPeriod } from '../utils/numberUtils';

interface CashflowCardProps {
  cashflow: NonNullable<DashboardData['cashflow']>;
  currency?: string;
}

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/** Small label over a figure; shrinks on a phone along with the figure. */
const labelSx = { color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.875rem' } };
const figureSx = { fontWeight: 700, fontSize: { xs: '1.05rem', md: '1.25rem' }, lineHeight: 1.3 };

/**
 * The dashboard's cash-flow summary.
 *
 * Built on the trailing twelve months rather than the current month: the newest
 * month is usually only part-imported, so a card keyed to it reports a collapse
 * in income every time. A rolling year is always a complete, comparable figure.
 */
const CashflowCard: React.FC<CashflowCardProps> = ({ cashflow, currency = 'EUR' }) => {
  const { trailing, previous, growth } = cashflow;
  const money = (v: number) => formatCurrency(v, currency);

  const changeFrom = (now: number, before: number | undefined) =>
    before === undefined || before === 0 ? null : ((now - before) / before) * 100;

  const savingsChange = changeFrom(trailing.savings, previous?.savings);

  // Share of the change attributable to contributions, for the split bar.
  const total = growth ? Math.abs(growth.contributions) + Math.abs(growth.marketGrowth) : 0;
  const contributionShare = total > 0 ? (Math.abs(growth!.contributions) / total) * 100 : 0;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.25 }}>
          <AccountBalanceWallet sx={{ mr: { xs: 1, md: 2 }, color: '#11998e', fontSize: { xs: 20, md: 24 } }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
            Cash Flow
          </Typography>
          <Button component={Link} to="/cash-flow" size="small" endIcon={<ArrowForward />}>
            Details
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: { xs: 1.5, md: 2.5 }, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
          Last 12 months · {formatPeriod(trailing.from)} – {formatPeriod(trailing.to)}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 2 },
            mb: growth ? { xs: 2, md: 3 } : 0
          }}
        >
          <Box>
            <Typography variant="body2" sx={labelSx}>Income</Typography>
            <Typography variant="h6" sx={figureSx}>{money(trailing.income)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={labelSx}>Spending</Typography>
            <Typography variant="h6" sx={figureSx}>{money(trailing.consumption)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={labelSx}>Kept</Typography>
            <Typography variant="h6" sx={{ ...figureSx, color: signColor(trailing.savings) }}>
              {money(trailing.savings)}
            </Typography>
            {savingsChange !== null && (
              <Chip
                size="small"
                variant="outlined"
                color={savingsChange >= 0 ? 'success' : 'error'}
                label={`${formatPct(savingsChange)} vs prior year`}
                sx={{ mt: 0.5, maxWidth: '100%', height: { xs: 20, md: 24 }, fontSize: { xs: '0.68rem', md: '0.8125rem' } }}
              />
            )}
          </Box>
          <Box>
            <Typography variant="body2" sx={labelSx}>Savings rate</Typography>
            <Typography variant="h6" sx={figureSx}>
              {trailing.savingsRate === null ? '—' : formatPct(trailing.savingsRate)}
            </Typography>
            {trailing.invested > 0 && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.3 }}>
                {money(trailing.invested)} invested
                {trailing.divested > 0 ? `, ${money(trailing.divested)} back out` : ''}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Only carried when the period is fully covered by transactions —
            see the dashboard service. */}
        {growth && (
          <Box>
            <Typography variant="body2" sx={{ ...labelSx, mb: 1 }}>
              Net worth moved {money(growth.netWorthChange)} from {formatPeriod(growth.from)} to{' '}
              {formatPeriod(growth.to)}
            </Typography>

            <Tooltip title={`${money(growth.contributions)} contributed · ${money(growth.marketGrowth)} market`}>
              <LinearProgress
                variant="determinate"
                value={contributionShare}
                sx={{
                  height: { xs: 8, md: 10 },
                  borderRadius: 5,
                  mb: { xs: 1, md: 1.5 },
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { bgcolor: '#11998e', borderRadius: 5 }
                }}
              />
            </Tooltip>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>You contributed</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.9rem', md: '1rem' } }}>{money(growth.contributions)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Market did</Typography>
                <Typography sx={{ fontWeight: 700, color: signColor(growth.marketGrowth), fontSize: { xs: '0.9rem', md: '1rem' } }}>
                  {growth.marketGrowth >= 0 ? '+' : ''}{money(growth.marketGrowth)}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CashflowCard;
