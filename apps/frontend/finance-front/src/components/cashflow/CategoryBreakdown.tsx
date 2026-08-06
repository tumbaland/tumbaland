import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Chip,
  Alert,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts';
import { Analytics } from '../../services/cashflowService';
import { formatCurrency, formatPct, formatCompactCurrency } from '../../utils/numberUtils';
import { linearTrend } from '../../utils/trend';

interface CategoryBreakdownProps {
  analytics: Analytics;
}

/** Distinct enough to tell apart, and stable per position in the sorted list. */
const PALETTE = [
  '#667eea', '#11998e', '#e05260', '#eab308', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b'
];

type View = 'share' | 'history';

/**
 * Where the money goes, per category. The stacked view answers "what is my
 * spending made of"; picking one category answers "and is that one growing".
 */
const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ analytics }) => {
  const [view, setView] = useState<View>('share');
  const [selected, setSelected] = useState<string>('');

  const currency = analytics.currency || 'EUR';
  const money = (v: number) => formatCurrency(v, currency);
  const investmentCategories = new Set(analytics.investmentCategories || []);

  const years = useMemo(() => analytics.years.map((y) => y.year), [analytics.years]);

  // Spending only — investing has its own place and would dwarf a category chart
  const consumption = useMemo(
    () => analytics.categoryTrends.filter((c) => !investmentCategories.has(c.category)),
    [analytics.categoryTrends, investmentCategories]
  );

  const invested = useMemo(
    () => analytics.categoryTrends.filter((c) => investmentCategories.has(c.category)),
    [analytics.categoryTrends, investmentCategories]
  );

  const latestYear = years[years.length - 1];
  const latestTotal = consumption.reduce((sum, c) => sum + (c.byYear[latestYear] || 0), 0);

  const detail = consumption.find((c) => c.category === selected);
  const detailSeries = detail ? years.map((y) => detail.byYear[y] || 0) : [];
  const detailSlope = detail ? linearTrend(detailSeries) : 0;

  if (consumption.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Where the money goes
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, next: View | null) => next && setView(next)}
        >
          <ToggleButton value="share">Share</ToggleButton>
          <ToggleButton value="history">Over time</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {invested.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {invested.map((c) => `${money(c.total)} ${c.category.toLowerCase()}`).join(' and ')} left the
          account over this period but bought an asset rather than being spent, so it is kept out of
          these charts and out of the savings rate.
        </Alert>
      )}

      {view === 'share' ? (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {latestYear} spending by category
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
              <PieChart
                series={[
                  {
                    data: consumption
                      .filter((c) => (c.byYear[latestYear] || 0) > 0)
                      .map((c, index) => ({
                        id: c.category,
                        value: c.byYear[latestYear] || 0,
                        label: c.category,
                        color: PALETTE[index % PALETTE.length]
                      })),
                    innerRadius: 55,
                    paddingAngle: 1,
                    cornerRadius: 3,
                    valueFormatter: (item) => money(item.value)
                  }
                ]}
                height={240}
                width={240}
                hideLegend
              />
              <Box sx={{ flexGrow: 1, minWidth: 240 }}>
                {consumption.slice(0, 10).map((c, index) => {
                  const value = c.byYear[latestYear] || 0;
                  const share = latestTotal > 0 ? (value / latestTotal) * 100 : 0;
                  return (
                    <Box
                      key={c.category}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, cursor: 'pointer' }}
                      onClick={() => { setSelected(c.category); setView('history'); }}
                    >
                      <Box
                        sx={{
                          width: 10, height: 10, borderRadius: '50%',
                          bgcolor: PALETTE[index % PALETTE.length], flexShrink: 0
                        }}
                      />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>{c.category}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {share.toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                        {money(value)}
                      </Typography>
                    </Box>
                  );
                })}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Pick a category to see its history
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Every category, year by year
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <BarChart
                height={320}
                xAxis={[{ data: years.map(String), scaleType: 'band' }]}
                yAxis={[{ valueFormatter: (v: number | null) => (v === null ? '' : formatCompactCurrency(v, currency)) }]}
                series={consumption.slice(0, 10).map((c, index) => ({
                  data: years.map((y) => c.byYear[y] || 0),
                  label: c.category,
                  color: PALETTE[index % PALETTE.length],
                  stack: 'spend',
                  valueFormatter: (v: number | null) => (v === null ? '' : money(v))
                }))}
                margin={{ left: 70 }}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              One category in detail
            </Typography>
            <TextField
              select
              size="small"
              label="Category"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              sx={{ minWidth: 200 }}
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Pick one…</MenuItem>
              {consumption.map((c) => (
                <MenuItem key={c.category} value={c.category}>{c.category}</MenuItem>
              ))}
            </TextField>
          </Box>

          {detail ? (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lifetime</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{money(detail.total)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{latestYear}</Typography>
                  <Typography sx={{ fontWeight: 700 }}>{money(detail.latest)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>vs previous year</Typography>
                  <Typography sx={{ fontWeight: 700, color: detail.change > 0 ? 'error.main' : 'success.main' }}>
                    {detail.changePct === null
                      ? `${detail.change >= 0 ? '+' : ''}${money(detail.change)}`
                      : formatPct(detail.changePct)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Trend</Typography>
                  <Typography sx={{ fontWeight: 700, color: detailSlope > 0 ? 'error.main' : 'success.main' }}>
                    {detailSlope >= 0 ? '+' : '−'}{money(Math.abs(detailSlope))} / year
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <BarChart
                  height={240}
                  xAxis={[{ data: years.map(String), scaleType: 'band' }]}
                  yAxis={[{ valueFormatter: (v: number | null) => (v === null ? '' : formatCompactCurrency(v, currency)) }]}
                  series={[
                    {
                      data: detailSeries,
                      label: detail.category,
                      color: '#667eea',
                      valueFormatter: (v: number | null) => (v === null ? '' : money(v))
                    }
                  ]}
                  margin={{ left: 70 }}
                />
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {consumption.slice(0, 12).map((c) => (
                <Chip
                  key={c.category}
                  size="small"
                  label={`${c.category} · ${money(c.total)}`}
                  onClick={() => setSelected(c.category)}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default CategoryBreakdown;
