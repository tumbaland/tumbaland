import React from 'react';
import { Alert, Box, Button, Card, CardContent, LinearProgress, Tooltip, Typography } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';
import { Link } from 'react-router';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency } from '../utils/numberUtils';
import { appPath } from '../appBase';

interface SafetyCardProps {
  safety: NonNullable<DashboardData['safety']>;
  currency?: string;
}

/** A guide to aim for, not a rule: a year of spending in cash covers most gaps in income. */
const GOAL_MONTHS = 12;

/** Months read as months up to two years, then as years. */
export const formatMonths = (months: number): string =>
  months < 24 ? `${months.toFixed(1)} months` : `${(months / 12).toFixed(1)} years`;

const SEGMENTS = [
  { key: 'cash', label: 'Cash', color: '#22c55e', hint: 'Spendable now' },
  { key: 'market', label: 'Sellable', color: '#3b82f6', hint: 'Funds and shares you could sell within days' },
  { key: 'locked', label: 'Locked', color: '#8b5cf6', hint: 'Pensions, property' },
  { key: 'unsorted', label: 'Not sorted', color: '#94a3b8', hint: 'Asset classes not yet marked' }
] as const;

/**
 * How long the money would last, and how much of it can actually be reached.
 *
 * Net worth says how much you have; this says how much of it is there when the
 * income stops. Runway is measured against what was consumed over the past
 * year, so buying funds does not count as spending it, and it is before any tax
 * a sale would cost.
 */
const SafetyCard: React.FC<SafetyCardProps> = ({ safety, currency = 'EUR' }) => {
  const money = (v: number) => formatCurrency(v, currency);
  const total = safety.cash + safety.market + safety.locked + safety.unsorted;
  const sorted = safety.cash + safety.market + safety.locked > 0;
  const cashProgress = safety.cashMonths === null ? 0 : Math.min(100, (safety.cashMonths / GOAL_MONTHS) * 100);

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 2.5 } }}>
          <ShieldIcon sx={{ mr: { xs: 1, md: 2 }, color: '#22c55e', fontSize: { xs: 20, md: 24 } }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
            Safety net
          </Typography>
        </Box>

        {!sorted ? (
          <Alert
            severity="info"
            action={
              <Button component={Link} to={appPath('/net-worth')} size="small">
                Net worth
              </Button>
            }
          >
            Mark each asset class as cash, sellable or locked to see how long your money would last.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Cash covers
            </Typography>
            {safety.cashMonths === null ? (
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
                Import a bank statement to measure your spending.
              </Typography>
            ) : (
              <>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
                  {formatMonths(safety.cashMonths)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  of spending, at {money(safety.monthlySpending ?? 0)} a month
                </Typography>
                <Tooltip title={`${money(safety.cash)} in cash against a guide of ${GOAL_MONTHS} months`}>
                  <LinearProgress
                    variant="determinate"
                    value={cashProgress}
                    aria-label={`Cash toward ${GOAL_MONTHS} months of spending`}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      mb: 0.5,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': { bgcolor: '#22c55e', borderRadius: 5 }
                    }}
                  />
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                  Aim for {GOAL_MONTHS} months in cash before your income stops.
                </Typography>
                {safety.reachableMonths !== null && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    With what you could sell as well: <strong>{formatMonths(safety.reachableMonths)}</strong>, before
                    tax.
                  </Typography>
                )}
              </>
            )}

            <Box
              role="img"
              aria-label="Money by how reachable it is"
              sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', mb: 1.5 }}
            >
              {SEGMENTS.map((s) =>
                safety[s.key] > 0 ? (
                  <Box key={s.key} sx={{ width: `${(safety[s.key] / total) * 100}%`, bgcolor: s.color }} />
                ) : null
              )}
            </Box>
            {SEGMENTS.map((s) =>
              safety[s.key] > 0 ? (
                <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.25 }}>
                  <Tooltip title={s.hint}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                      <Typography variant="body2">{s.label}</Typography>
                    </Box>
                  </Tooltip>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {money(safety[s.key])}
                  </Typography>
                </Box>
              ) : null
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SafetyCard;
