import React from 'react';
import { Card, CardContent, Typography, Box, alpha } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat, AccountBalance, CalendarMonth, Savings } from '@mui/icons-material';
import { DashboardKPIs } from '../services/dashboardService';
import { formatCurrency, formatPct } from '../utils/numberUtils';

interface FinancialKPIsProps {
  kpis: DashboardKPIs;
  /** Base currency all KPI amounts are expressed in. */
  currency?: string;
}

interface Tile {
  label: string;
  sublabel?: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  accent: string;
  valueColor?: string;
}

const trendIcon = (v: number) =>
  v > 0 ? <TrendingUp sx={{ fontSize: { xs: 24, md: 28 } }} />
  : v < 0 ? <TrendingDown sx={{ fontSize: { xs: 24, md: 28 } }} />
  : <TrendingFlat sx={{ fontSize: { xs: 24, md: 28 } }} />;

const trendColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.primary');

const signed = (v: number, currency: string) =>
  `${v >= 0 ? '+' : ''}${formatCurrency(v, currency)}`;

const FinancialKPIs: React.FC<FinancialKPIsProps> = ({ kpis, currency = 'EUR' }) => {
  const money = (v: number) => formatCurrency(v, currency);

  // A missing comparison period reads as "—": there is no check-in that far
  // back, which is not the same as no change.
  const changeTile = (
    label: string,
    change: number | null,
    pct: number | null,
    icon: React.ReactNode,
    accent: string
  ): Tile => ({
    label,
    sublabel: change === null ? 'no check-in to compare' : undefined,
    value: change === null ? '—' : signed(change, currency),
    detail: pct === null ? undefined : formatPct(pct),
    icon,
    accent,
    valueColor: change === null ? 'text.secondary' : trendColor(change)
  });

  const tiles: Tile[] = [
    {
      label: 'Net worth',
      sublabel: kpis.asOf ? `as of ${kpis.asOf.slice(0, 7)}` : undefined,
      value: money(kpis.netWorth),
      detail: kpis.liabilities > 0
        ? `${money(kpis.assets)} assets − ${money(kpis.liabilities)} debt`
        : undefined,
      icon: <AccountBalance sx={{ fontSize: { xs: 24, md: 28 } }} />,
      accent: '#667eea'
    },
    changeTile(
      'Past month',
      kpis.monthChange,
      kpis.monthChangePct,
      trendIcon(kpis.monthChange ?? 0),
      '#11998e'
    ),
    changeTile(
      'Past year',
      kpis.yearChange,
      kpis.yearChangePct,
      <CalendarMonth sx={{ fontSize: { xs: 24, md: 28 } }} />,
      '#8b5cf6'
    ),
    {
      label: 'Total gain',
      sublabel: 'vs invested',
      value: signed(kpis.totalGain, currency),
      detail: formatPct(kpis.totalGainPct),
      icon: <Savings sx={{ fontSize: { xs: 24, md: 28 } }} />,
      accent: '#eab308',
      valueColor: trendColor(kpis.totalGain)
    }
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        gap: { xs: 2, md: 3 },
        mb: { xs: 3, md: 4 }
      }}
    >
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 4px 20px ${alpha(tile.accent, 0.15)}`,
              borderColor: alpha(tile.accent, 0.5)
            }
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: alpha(tile.accent, 0.1),
                  color: tile.accent,
                  mr: 1.5,
                  display: 'flex'
                }}
              >
                {tile.icon}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {tile.label}
                </Typography>
                {tile.sublabel && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {tile.sublabel}
                  </Typography>
                )}
              </Box>
            </Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: tile.valueColor || 'text.primary', fontSize: { xs: '1.4rem', md: '1.6rem' } }}
            >
              {tile.value}
            </Typography>
            {tile.detail && (
              <Typography variant="body2" sx={{ color: tile.valueColor || 'text.secondary', mt: 0.5 }}>
                {tile.detail}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default FinancialKPIs;
