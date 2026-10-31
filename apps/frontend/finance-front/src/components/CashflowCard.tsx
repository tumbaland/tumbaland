import React from 'react';
import { Card, CardContent, Typography, Box, Button, LinearProgress, Tooltip, Chip } from '@mui/material';
import { AccountBalanceWallet, ArrowForward } from '@mui/icons-material';
import { Link } from 'react-router';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency, formatPct, formatPeriod } from '../utils/numberUtils';
import { appPath } from '../appBase';

interface CashflowCardProps {
  cashflow: NonNullable<DashboardData['cashflow']>;
  currency?: string;
}

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

/** Small label over a figure; shrinks on a phone along with the figure. */
const labelSx = { color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.875rem' } };
/** The two shares of what net worth moved: what you added, and what the market did. */
const CONTRIBUTED_COLOR = '#11998e';
const marketColor = (marketGrowth: number) => (marketGrowth >= 0 ? '#667eea' : '#ef4444');

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, alignSelf: 'center', flexShrink: 0 }} />
);

const figureSx = { fontWeight: 700, fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.3 };

/** One source of income, small, under the total it belongs to. */
const IncomeLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, maxWidth: 190 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>{label}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.4 }}>{value}</Typography>
  </Box>
);

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

  // What the money itself paid, which is the part that carries on when the
  // salary stops. Absent from a service that predates the breakdown.
  const incomeBy = trailing.incomeBy;
  const fromAssets = incomeBy ? incomeBy.dividends + incomeBy.interest : 0;

  // Share of the change attributable to contributions, for the split bar.
  const total = growth ? Math.abs(growth.contributions) + Math.abs(growth.marketGrowth) : 0;
  const contributionShare = total > 0 ? (Math.abs(growth!.contributions) / total) * 100 : 0;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 1.5, md: 2.5 }, '&:last-child': { pb: { xs: 1.5, md: 2.5 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.5, mb: { xs: 1.25, md: 1.5 } }}>
          <AccountBalanceWallet sx={{ mr: 0.5, color: '#11998e', fontSize: 20, alignSelf: 'center' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', md: '1.1rem' } }}>
            Cash Flow
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1, fontSize: { xs: '0.72rem', md: '0.8rem' } }}>
            Last 12 months · {formatPeriod(trailing.from)} – {formatPeriod(trailing.to)}
          </Typography>
          <Button component={Link} to={appPath('/cash-flow')} size="small" endIcon={<ArrowForward />}>
            Details
          </Button>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: { xs: 1.25, md: 2 },
            mb: growth ? { xs: 1.5, md: 2 } : 0
          }}
        >
          <Box>
            <Typography variant="body2" sx={labelSx}>Income</Typography>
            <Typography variant="h6" sx={figureSx}>{money(trailing.income)}</Typography>
            {incomeBy && (
              <Box sx={{ mt: 0.25 }}>
                <IncomeLine label="Salary" value={money(incomeBy.salary)} />
                <Tooltip
                  title={`Dividends ${money(incomeBy.dividends)} · interest ${money(incomeBy.interest)}`}
                >
                  <Box>
                    <IncomeLine label="From assets" value={money(fromAssets)} />
                  </Box>
                </Tooltip>
                {incomeBy.other > 0.5 && <IncomeLine label="Other" value={money(incomeBy.other)} />}
              </Box>
            )}
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
                sx={{ mt: 0.25, maxWidth: '100%', height: 20, fontSize: '0.68rem' }}
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 0.5 }}>
              <Typography variant="body2" sx={{ ...labelSx, fontWeight: 600 }}>
                Net worth moved {money(growth.netWorthChange)} from {formatPeriod(growth.from)} to{' '}
                {formatPeriod(growth.to)}
              </Typography>
            </Box>

            <Tooltip title={`${money(growth.contributions)} contributed · ${money(growth.marketGrowth)} market`}>
              <LinearProgress
                variant="determinate"
                value={contributionShare}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  mb: 0.75,
                  // The track is the market's share, not empty space: grey read as
                  // "nothing" and left the market with no colour of its own.
                  bgcolor: marketColor(growth.marketGrowth),
                  '& .MuiLinearProgress-bar': { bgcolor: CONTRIBUTED_COLOR, borderRadius: 4 }
                }}
              />
            </Tooltip>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Dot color={CONTRIBUTED_COLOR} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>You contributed</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{money(growth.contributions)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Dot color={marketColor(growth.marketGrowth)} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Market did</Typography>
                <Typography sx={{ fontWeight: 700, color: signColor(growth.marketGrowth), fontSize: '0.95rem' }}>
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
