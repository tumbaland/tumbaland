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

const ICON_SIZE = { xs: 18, md: 28 };

const trendIcon = (v: number) =>
  v > 0 ? <TrendingUp sx={{ fontSize: ICON_SIZE }} />
  : v < 0 ? <TrendingDown sx={{ fontSize: ICON_SIZE }} />
  : <TrendingFlat sx={{ fontSize: ICON_SIZE }} />;

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
      icon: <AccountBalance sx={{ fontSize: ICON_SIZE }} />,
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
      <CalendarMonth sx={{ fontSize: ICON_SIZE }} />,
      '#8b5cf6'
    ),
    {
      label: 'Total gain',
      sublabel: 'vs invested',
      value: signed(kpis.totalGain, currency),
      detail: formatPct(kpis.totalGainPct),
      icon: <Savings sx={{ fontSize: ICON_SIZE }} />,
      accent: '#eab308',
      valueColor: trendColor(kpis.totalGain)
    }
  ];

  return (
    // Two per row on a phone: one per row made the four figures fill the first
    // screen before the chart.
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        gap: { xs: 1.5, md: 3 },
        mb: { xs: 2, md: 4 }
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
          <CardContent sx={{ p: { xs: 1.5, md: 3 }, '&:last-child': { pb: { xs: 1.5, md: 3 } } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 0.75, md: 1.5 } }}>
              <Box
                sx={{
                  p: { xs: 0.5, md: 1.25 },
                  borderRadius: 2,
                  bgcolor: alpha(tile.accent, 0.1),
                  color: tile.accent,
                  mr: { xs: 1, md: 1.5 },
                  display: 'flex',
                  flexShrink: 0
                }}
              >
                {tile.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '0.8rem', md: '0.875rem' } }}
                >
                  {tile.label}
                </Typography>
                {tile.sublabel && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.2, fontSize: { xs: '0.68rem', md: '0.75rem' } }}
                  >
                    {tile.sublabel}
                  </Typography>
                )}
              </Box>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: tile.valueColor || 'text.primary',
                fontSize: { xs: '1.15rem', md: '1.6rem' },
                lineHeight: 1.25
              }}
            >
              {tile.value}
            </Typography>
            {tile.detail && (
              <Typography
                variant="body2"
                sx={{
                  color: tile.valueColor || 'text.secondary',
                  mt: 0.25,
                  fontSize: { xs: '0.72rem', md: '0.875rem' },
                  lineHeight: 1.35
                }}
              >
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
