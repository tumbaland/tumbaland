import React from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { DashboardKPIs } from '../services/dashboardService';
import { formatCurrency, formatPct } from '../utils/numberUtils';

interface NetWorthHeroProps {
  kpis: DashboardKPIs;
  /** Base currency all amounts are expressed in. */
  currency?: string;
}

const signed = (v: number, currency: string) => `${v >= 0 ? '+' : ''}${formatCurrency(v, currency)}`;
const trendColor = (v: number) => (v > 0 ? 'success' : v < 0 ? 'error' : 'default');

/**
 * The first thing the dashboard says: what you are worth, and whether that is
 * going up.
 *
 * One large figure with the two changes beside it, instead of four equal tiles:
 * the tiles gave the month, the year and the lifetime gain the same weight as
 * the number they were changes of. A missing comparison reads as "no check-in
 * to compare" rather than as a change of zero.
 */
const NetWorthHero: React.FC<NetWorthHeroProps> = ({ kpis, currency = 'EUR' }) => {
  const change = (label: string, value: number | null, pct: number | null) => (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
        {label}
      </Typography>
      {value === null ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          no check-in to compare
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.05rem', md: '1.25rem' },
              color: value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary'
            }}
          >
            {signed(value, currency)}
          </Typography>
          {pct !== null && (
            <Chip size="small" variant="outlined" color={trendColor(value)} label={formatPct(pct)} />
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Net worth{kpis.asOf ? ` · ${kpis.asOf.slice(0, 7)}` : ''}
            </Typography>
            <Typography
              variant="h3"
              component="p"
              sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.5rem' }, lineHeight: 1.15 }}
            >
              {formatCurrency(kpis.netWorth, currency)}
            </Typography>
            {kpis.liabilities > 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {formatCurrency(kpis.assets, currency)} assets − {formatCurrency(kpis.liabilities, currency)} debt
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: { xs: 3, md: 4 }, flexWrap: 'wrap' }}>
            {change('Past month', kpis.monthChange, kpis.monthChangePct)}
            {change('Past year', kpis.yearChange, kpis.yearChangePct)}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default NetWorthHero;
