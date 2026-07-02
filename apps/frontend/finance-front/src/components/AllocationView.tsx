import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import { PieChart, BarChart, Download, ContentCopy } from '@mui/icons-material';

interface AssetStats {
  ticker: string;
  expectedReturn: number; // in percent
  volatility: number; // in percent
  sharpeRatio: number;
}

interface OptimalPortfolioMetrics {
  expectedReturn: number; // percent
  volatility: number; // percent
  sharpeRatio: number;
}

interface AllocationViewProps {
  portfolio: OptimalPortfolioMetrics & { weights: Record<string, number> };
  allocation: Record<string, number>; // EUR amounts
  assetStats: AssetStats[];
  investmentAmount: number;
  selectedCount?: number;
  allowShorts?: boolean;
}

const AllocationView: React.FC<AllocationViewProps> = ({
  portfolio,
  allocation,
  assetStats,
  investmentAmount,
  selectedCount,
  allowShorts
}) => {
  const [view, setView] = React.useState<'donut' | 'bars'>('donut');
  const [minPct, setMinPct] = React.useState<number>(0.1); // hide tiny allocations

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  const asPct = (w: number) => `${(w * 100).toFixed(2)}%`;

  const rows = React.useMemo(() => {
    const items = Object.entries(portfolio.weights).map(([ticker, weight]) => {
      const stat = assetStats.find(s => s.ticker === ticker);
      const amount = allocation[ticker] ?? (weight * investmentAmount);
      return {
        ticker,
        weight,
        amount,
        expectedReturn: stat?.expectedReturn ?? 0,
        volatility: stat?.volatility ?? 0,
        sharpeRatio: stat?.sharpeRatio ?? 0
      };
    });
    return items
      .filter(r => (r.weight * 100) >= minPct) // threshold filter in percent
      .sort((a, b) => b.weight - a.weight);
  }, [portfolio.weights, allocation, assetStats, investmentAmount, minPct]);

  const colors = ['#1976d2','#2e7d32','#d32f2f','#f57c00','#7b1fa2','#0097a7','#5d4037','#455a64','#e91e63','#3f51b5'];

  const size = 260; const center = size/2; const radius = 88; const inner = 46;
  let cumulative = 0;
  const polar = (cx:number, cy:number, r:number, deg:number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arc = (start:number, end:number, R:number, r:number) => {
    const s = polar(center, center, R, end);
    const e = polar(center, center, R, start);
    const large = end - start <= 180 ? 0 : 1;
    const os = `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 0 ${e.x} ${e.y}`;
    const is = polar(center, center, r, end);
    const ie = polar(center, center, r, start);
    const innerPath = `L ${ie.x} ${ie.y} A ${r} ${r} 0 ${large} 0 ${is.x} ${is.y}`;
    return `${os} ${innerPath} Z`;
  };

  const copyCSV = () => {
    const csvRows = [
      ['Ticker','Weight %','Amount EUR','Expected Return %','Volatility %','Sharpe']
    ];
    rows.forEach(r => csvRows.push([r.ticker, (r.weight*100).toFixed(2), Math.round(r.amount).toString(), r.expectedReturn.toFixed(2), r.volatility.toFixed(2), r.sharpeRatio.toFixed(3)]));
    const text = csvRows.map(r => r.join(',')).join('\n');
    navigator.clipboard?.writeText(text);
  };

  const downloadCSV = () => {
    const csvRows = [
      ['Ticker','Weight %','Amount EUR','Expected Return %','Volatility %','Sharpe']
    ];
    rows.forEach(r => csvRows.push([r.ticker, (r.weight*100).toFixed(2), Math.round(r.amount).toString(), r.expectedReturn.toFixed(2), r.volatility.toFixed(2), r.sharpeRatio.toFixed(3)]));
    const blob = new Blob([csvRows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'allocation.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const SummaryCards = (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
      <Card sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', color: 'white' }}>
        <CardContent>
          <Typography variant="subtitle2">Expected Return</Typography>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{portfolio.expectedReturn.toFixed(2)}%</Typography>
        </CardContent>
      </Card>
      <Card sx={{ background: 'linear-gradient(135deg, #ed6c02 0%, #ff9800 100%)', color: 'white' }}>
        <CardContent>
          <Typography variant="subtitle2">Risk (Volatility)</Typography>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{portfolio.volatility.toFixed(2)}%</Typography>
        </CardContent>
      </Card>
      <Card sx={{ background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', color: 'white' }}>
        <CardContent>
          <Typography variant="subtitle2">Sharpe Ratio</Typography>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{portfolio.sharpeRatio.toFixed(3)}</Typography>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {SummaryCards}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Typography variant="h6">Allocation</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 200 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Hide positions below: {minPct.toFixed(1)}%</Typography>
                <Slider size="small" min={0} max={5} step={0.1} value={minPct} onChange={(_, v) => setMinPct(v as number)} />
              </Box>
              <ToggleButtonGroup size="small" value={view} exclusive onChange={(_, v) => v && setView(v)}>
                <ToggleButton value="donut"><PieChart fontSize="small" sx={{ mr: 0.5 }} />Donut</ToggleButton>
                <ToggleButton value="bars"><BarChart fontSize="small" sx={{ mr: 0.5 }} />Bars</ToggleButton>
              </ToggleButtonGroup>
              <Button variant="outlined" size="small" startIcon={<ContentCopy />} onClick={copyCSV}>Copy CSV</Button>
              <Button variant="outlined" size="small" startIcon={<Download />} onClick={downloadCSV}>Download CSV</Button>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: { xs: 'center', md: 'flex-start' } }}>
            {/* Chart */}
            <Box sx={{ flex: '0 0 auto' }}>
              {view === 'donut' ? (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  {rows.map((r, idx) => {
                    const pct = r.weight * 100;
                    const start = (cumulative / 100) * 360;
                    const end = ((cumulative + pct) / 100) * 360;
                    cumulative += pct;
                    return (
                      <path key={r.ticker} d={arc(start, end, radius, inner)} fill={colors[idx % colors.length]} stroke="white" strokeWidth={2}>
                        <title>{`${r.ticker}: ${formatCurrency(r.amount)} (${pct.toFixed(1)}%)`}</title>
                      </path>
                    );
                  })}
                  <text x={center} y={center - 8} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#666">Total</text>
                  <text x={center} y={center + 8} textAnchor="middle" fontSize="12" fill="#666">{formatCurrency(investmentAmount)}</text>
                </svg>
              ) : (
                <Box sx={{ width: 340, height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, pb: 1 }}>
                  {rows.map((r, idx) => (
                    <Box key={r.ticker} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, bgcolor: colors[idx % colors.length], borderRadius: '50%' }} />
                      <Typography variant="caption" sx={{ width: 48 }}>{r.ticker}</Typography>
                      <Box sx={{ flex: 1, bgcolor: 'grey.200', borderRadius: 1 }}>
                        <Box sx={{ width: `${(r.weight * 100).toFixed(2)}%`, bgcolor: colors[idx % colors.length], color: 'white', px: 1, borderRadius: 1 }}>
                          <Typography variant="caption">{asPct(r.weight)}</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ width: 72, textAlign: 'right' }}>{formatCurrency(r.amount)}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Table */}
            <Box sx={{ flex: 1, minWidth: 360 }}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Asset</TableCell>
                      <TableCell align="right">Weight</TableCell>
                      <TableCell align="right">Allocation</TableCell>
                      <TableCell align="right">Exp. Return</TableCell>
                      <TableCell align="right">Volatility</TableCell>
                      <TableCell align="right">Sharpe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={r.ticker} hover>
                        <TableCell sx={{ fontWeight: 'medium' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, bgcolor: colors[idx % colors.length], borderRadius: '50%' }} />
                            {r.ticker}
                          </Box>
                        </TableCell>
                        <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 'bold' }}>{asPct(r.weight)}</Typography></TableCell>
                        <TableCell align="right">{formatCurrency(r.amount)}</TableCell>
                        <TableCell align="right">{r.expectedReturn.toFixed(2)}%</TableCell>
                        <TableCell align="right"><Chip label={`${r.volatility.toFixed(1)}%`} size="small" variant="outlined" /></TableCell>
                        <TableCell align="right">{r.sharpeRatio.toFixed(3)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{asPct(Object.values(portfolio.weights).reduce((s, w) => s + w, 0))}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(investmentAmount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{portfolio.expectedReturn.toFixed(2)}%</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{portfolio.volatility.toFixed(2)}%</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{portfolio.sharpeRatio.toFixed(3)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 2, border: '1px solid', borderColor: 'info.200' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'info.main', mb: 1 }}>Summary</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>Positions (non-zero):</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{rows.length}</Typography>
                  </Box>
                  {typeof selectedCount === 'number' && (
                    <Box>
                      <Typography variant="body2" sx={{
                        color: "text.secondary"
                      }}>Selected Assets:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedCount}</Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>Shorting:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{allowShorts ? 'Allowed' : 'Disabled'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>Largest Position:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{rows[0] ? (rows[0].weight * 100).toFixed(1) + '%' : '-'}</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AllocationView;
