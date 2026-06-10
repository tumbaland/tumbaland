import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField,
  Chip,
  Button,
  Slider,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTenantFilter } from '../components/tenant';
import { useUserPortfolios } from '../hooks/useUserPortfolio';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { getTickerPriceHistory } from '../services/tickerPriceHistoryService';

// ── math ─────────────────────────────────────────────────────────────────────

const TRADING_DAYS = 252;
const SIMULATIONS = 2000;

function dailyReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  return r;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function covEntry(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  return a.slice(0, n).reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (n - 1);
}

function portfolioStats(
  weights: number[],
  means: number[],
  cov: number[][],
  rfDaily: number
): { ret: number; vol: number; sharpe: number } {
  const dailyRet = weights.reduce((s, w, i) => s + w * means[i], 0);
  let dailyVar = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++)
      dailyVar += weights[i] * weights[j] * cov[i][j];
  const ret = dailyRet * TRADING_DAYS * 100;
  const vol = Math.sqrt(Math.max(0, dailyVar * TRADING_DAYS)) * 100;
  const sharpe = vol > 0 ? (ret - rfDaily * TRADING_DAYS * 100) / vol : 0;
  return { ret, vol, sharpe };
}

// Dirichlet-like random weights (exponential trick for uniform distribution on simplex)
function randomWeights(n: number): number[] {
  const raw = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-10));
  const sum = raw.reduce((s, x) => s + x, 0);
  return raw.map(x => x / sum);
}

// ── types ────────────────────────────────────────────────────────────────────

interface SimPoint {
  ret: number;
  vol: number;
  sharpe: number;
  weights: number[];
}

interface SimResult {
  tickers: string[];
  points: SimPoint[];
  maxSharpe: SimPoint;
  minVol: SimPoint;
  current: SimPoint | null;
  dataPoints: number; // number of trading days used
}

// ── component ────────────────────────────────────────────────────────────────

const PortfolioOptimizer: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { data: portfolios = [], isLoading: portfolioLoading } = useUserPortfolios(tenantGroupId);
  const { data: trackedTickers = [] } = useTrackedTickers(tenantGroupId);

  const [pricesByTicker, setPricesByTicker] = useState<Record<string, number[]>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [riskFreeRate, setRiskFreeRate] = useState(3); // % per year

  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(500);

  // Display name lookup
  const nameByTicker = useMemo(() => {
    const m: Record<string, string> = {};
    trackedTickers.forEach(t => (m[t.ticker] = t.displayName));
    return m;
  }, [trackedTickers]);

  // Load all price history in one call, group by ticker
  useEffect(() => {
    if (portfolios.length === 0) return;
    const portfolioTickers = new Set(portfolios.map(p => p.ticker));
    setLoadingPrices(true);
    setPriceError(null);

    getTickerPriceHistory()
      .then(all => {
        const rawMap: Record<string, { date: string; price: number }[]> = {};
        all
          .filter(d => portfolioTickers.has(d.ticker) && d.price > 0)
          .forEach(d => {
            if (!rawMap[d.ticker]) rawMap[d.ticker] = [];
            rawMap[d.ticker].push({ date: d.date, price: d.price });
          });

        const sorted: Record<string, number[]> = {};
        Object.entries(rawMap).forEach(([ticker, entries]) => {
          const prices = entries
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(e => e.price);
          if (prices.length >= 20) sorted[ticker] = prices;
        });
        setPricesByTicker(sorted);
      })
      .catch(() => setPriceError('Failed to load price history'))
      .finally(() => setLoadingPrices(false));
  }, [portfolios]);

  // Resize observer for chart container
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartWidth(Math.max(300, el.offsetWidth)));
    ro.observe(el);
    setChartWidth(Math.max(300, el.offsetWidth));
    return () => ro.disconnect();
  }, []);

  // Monte Carlo simulation — stored as state so results are stable across re-renders.
  // Re-runs only when: (a) price data first loads, or (b) user clicks Re-run.
  const [sim, setSim] = useState<SimResult | null>(null);

  const runSimulation = () => {
    const tickers = Object.keys(pricesByTicker);
    if (tickers.length < 2) { setSim(null); return; }

    const returnSeries = tickers.map(t => dailyReturns(pricesByTicker[t]));
    const means = returnSeries.map(r => mean(r));
    const cov = tickers.map((_, i) => tickers.map((_, j) => covEntry(returnSeries[i], returnSeries[j])));
    const rfDaily = riskFreeRate / 100 / TRADING_DAYS;

    const points: SimPoint[] = [];
    for (let s = 0; s < SIMULATIONS; s++) {
      const w = randomWeights(tickers.length);
      points.push({ ...portfolioStats(w, means, cov, rfDaily), weights: w });
    }

    const maxSharpe = points.reduce((b, p) => (p.sharpe > b.sharpe ? p : b), points[0]);
    const minVol = points.reduce((b, p) => (p.vol < b.vol ? p : b), points[0]);

    const latestPrices: Record<string, number> = {};
    tickers.forEach(t => (latestPrices[t] = pricesByTicker[t][pricesByTicker[t].length - 1]));

    const values = tickers.map(t => {
      const holding = portfolios.find(p => p.ticker === t);
      return holding ? holding.quantity * latestPrices[t] : 0;
    });
    const totalVal = values.reduce((s, v) => s + v, 0);

    let current: SimPoint | null = null;
    if (totalVal > 0) {
      const w = values.map(v => v / totalVal);
      current = { ...portfolioStats(w, means, cov, rfDaily), weights: w };
    }

    const dataPoints = Math.min(...returnSeries.map(r => r.length));
    setSim({ tickers, points, maxSharpe, minVol, current, dataPoints });
  };

  // Auto-run once when price data is ready; manual re-run via button
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (Object.keys(pricesByTicker).length >= 2) runSimulation(); }, [pricesByTicker]);

  // Per-holding performance stats
  const holdingStats = useMemo(() => {
    return portfolios
      .map(p => {
        const prices = pricesByTicker[p.ticker];
        const latestPrice = prices ? prices[prices.length - 1] : null;
        const returnPct = latestPrice != null
          ? ((latestPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100
          : null;
        const currentValue = latestPrice != null ? latestPrice * p.quantity : null;
        return { ...p, latestPrice, returnPct, currentValue };
      })
      .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  }, [portfolios, pricesByTicker]);

  const totalValue = holdingStats.reduce((s, h) => s + (h.currentValue ?? 0), 0);

  // Target risk level chosen by the user via slider
  const [targetVol, setTargetVol] = useState<number | null>(null);
  const [investAmount, setInvestAmount] = useState<string>('1000');

  // Set slider default to maxSharpe vol when simulation first runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sim && targetVol === null) setTargetVol(sim.maxSharpe.vol); }, [sim]);

  // Efficient frontier point at or below targetVol: highest return at that risk level
  const targetPortfolio = useMemo(() => {
    if (!sim) return null;
    const vol = targetVol ?? sim.maxSharpe.vol;
    const candidates = sim.points.filter(p => p.vol <= vol);
    if (candidates.length === 0) return sim.minVol;
    return candidates.reduce((b, p) => p.ret > b.ret ? p : b);
  }, [sim, targetVol]);

  // Analysis: deltas between current portfolio and target
  const analysis = useMemo(() => {
    if (!sim?.current || !targetPortfolio) return null;
    const c = sim.current;
    return {
      sharpeDelta: targetPortfolio.sharpe - c.sharpe,
      volDelta: c.vol - targetPortfolio.vol,   // positive = target is less volatile
      retDelta: targetPortfolio.ret - c.ret,
    };
  }, [sim, targetPortfolio]);

  // Buy-only plan: how to allocate next investment to move toward target
  const investEuros = parseFloat(investAmount) || 0;
  const buyPlan = useMemo(() => {
    if (!sim?.current || !targetPortfolio || totalValue <= 0 || investEuros <= 0) return null;
    const tickers = sim.tickers;
    const newTotal = totalValue + investEuros;
    const needed = tickers.map((_, i) => {
      const currentVal = sim.current!.weights[i] * totalValue;
      const targetVal = targetPortfolio.weights[i] * newTotal;
      return Math.max(0, targetVal - currentVal);
    });
    const totalNeeded = needed.reduce((s, n) => s + n, 0);
    return tickers.map((ticker, i) => {
      const currentVal = sim.current!.weights[i] * totalValue;
      const buyAmt = totalNeeded > 0 ? (needed[i] / totalNeeded) * investEuros : investEuros / tickers.length;
      return {
        ticker,
        currentPct: sim.current!.weights[i] * 100,
        targetPct: targetPortfolio.weights[i] * 100,
        buyAmt,
        resultPct: ((currentVal + buyAmt) / newTotal) * 100,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, targetPortfolio, investEuros, totalValue]);

  // ── chart helpers ───────────────────────────────────────────────────────────

  const MARGIN = { top: 30, right: 30, bottom: 55, left: 65 };
  const chartHeight = 780;
  const innerW = chartWidth - MARGIN.left - MARGIN.right;
  const innerH = chartHeight - MARGIN.top - MARGIN.bottom;

  const chartData = useMemo(() => {
    if (!sim) return null;
    const vols = sim.points.map(p => p.vol);
    const rets = sim.points.map(p => p.ret);
    // tight padding so the data fills the plot area
    const volSpan = Math.max(...vols) - Math.min(...vols);
    const retSpan = Math.max(...rets) - Math.min(...rets);
    const minVol = Math.min(...vols) - volSpan * 0.05;
    const maxVol = Math.max(...vols) + volSpan * 0.05;
    const minRet = Math.min(...rets) - retSpan * 0.05;
    const maxRet = Math.max(...rets) + retSpan * 0.05;
    const toX = (v: number) => ((v - minVol) / (maxVol - minVol)) * innerW;
    const toY = (r: number) => innerH - ((r - minRet) / (maxRet - minRet)) * innerH;
    const sharpes = sim.points.map(p => p.sharpe);
    const minSharpe = Math.min(...sharpes);
    const maxSharpe = Math.max(...sharpes);
    const sharpeColor = (s: number) => {
      const t = Math.max(0, Math.min(1, (s - minSharpe) / (maxSharpe - minSharpe + 1e-9)));
      // blue → teal → green
      const r = Math.round(30 + (1 - t) * 100);
      const g = Math.round(100 + t * 120);
      const b = Math.round(200 - t * 100);
      return `rgb(${r},${g},${b})`;
    };
    const yTicks = Array.from({ length: 8 }, (_, i) => minRet + (i / 7) * (maxRet - minRet));
    const xTicks = Array.from({ length: 10 }, (_, i) => minVol + (i / 9) * (maxVol - minVol));
    return { toX, toY, sharpeColor, yTicks, xTicks, minVol, maxVol, minRet, maxRet };
  }, [sim, innerW, innerH]);

  // ── render ──────────────────────────────────────────────────────────────────

  const isLoading = portfolioLoading || loadingPrices;

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (portfolios.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Portfolio Optimizer</Typography>
        <Alert severity="info">Add holdings in the Portfolio page first.</Alert>
      </Box>
    );
  }

  const tickersWithoutData = portfolios
    .map(p => p.ticker)
    .filter(t => !pricesByTicker[t]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Portfolio Optimizer</Typography>

      {priceError && <Alert severity="error" sx={{ mb: 2 }}>{priceError}</Alert>}

      {tickersWithoutData.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No price history for: {tickersWithoutData.join(', ')}. Fetch data in Tracked Tickers first.
        </Alert>
      )}

      {/* ── Holdings performance ─────────────────────────────────────────── */}
      <Typography variant="h6" sx={{ mb: 1 }}>Current Holdings</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 600 } }}>
              <TableCell>Ticker</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Avg Buy</TableCell>
              <TableCell align="right">Current Price</TableCell>
              <TableCell align="right">Return</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Weight</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holdingStats.map(h => (
              <TableRow key={h.ticker} hover>
                <TableCell sx={{ fontWeight: 600 }}>{h.ticker}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                  {nameByTicker[h.ticker] ?? '—'}
                </TableCell>
                <TableCell align="right">{h.quantity}</TableCell>
                <TableCell align="right">{h.avgBuyPrice.toFixed(2)}</TableCell>
                <TableCell align="right">{h.latestPrice != null ? h.latestPrice.toFixed(2) : '—'}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color: h.returnPct == null ? 'text.secondary' : h.returnPct >= 0 ? 'success.main' : 'error.main',
                    fontWeight: 600
                  }}
                >
                  {h.returnPct != null ? `${h.returnPct >= 0 ? '+' : ''}${h.returnPct.toFixed(2)}%` : '—'}
                </TableCell>
                <TableCell align="right">
                  {h.currentValue != null ? h.currentValue.toFixed(2) : '—'}
                </TableCell>
                <TableCell align="right">
                  {h.currentValue != null && totalValue > 0
                    ? `${((h.currentValue / totalValue) * 100).toFixed(1)}%`
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Efficient frontier ───────────────────────────────────────────── */}
      {sim && chartData ? (
        <>
          {/* Two-column layout: chart left, controls + table right */}
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', mb: 3 }}>

            {/* ── Left: chart ── */}
            <Box sx={{ flex: '0 0 55%', minWidth: 0 }}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0 }} ref={chartRef}>
                <svg width={chartWidth} height={chartHeight}>
                  <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                    {chartData.yTicks.map((r, i) => (
                      <g key={i}>
                        <line x1={0} y1={chartData.toY(r)} x2={innerW} y2={chartData.toY(r)} stroke="#f0f0f0" />
                        <text x={-8} y={chartData.toY(r) + 4} textAnchor="end" fontSize={11} fill="#888">{r.toFixed(1)}%</text>
                      </g>
                    ))}
                    {chartData.xTicks.map((v, i) => (
                      <g key={i}>
                        <line x1={chartData.toX(v)} y1={0} x2={chartData.toX(v)} y2={innerH} stroke="#f0f0f0" />
                        <text x={chartData.toX(v)} y={innerH + 16} textAnchor="middle" fontSize={11} fill="#888">{v.toFixed(1)}%</text>
                      </g>
                    ))}
                    <text x={innerW / 2} y={innerH + 38} textAnchor="middle" fontSize={12} fill="#555">Annualised Volatility (%)</text>
                    <text transform={`rotate(-90) translate(${-innerH / 2}, ${-40})`} textAnchor="middle" fontSize={12} fill="#555">Annualised Return (%)</text>
                    {sim.points.map((p, i) => (
                      <circle key={i} cx={chartData.toX(p.vol)} cy={chartData.toY(p.ret)} r={2.5} fill={chartData.sharpeColor(p.sharpe)} opacity={0.55} />
                    ))}
                    <circle cx={chartData.toX(sim.minVol.vol)} cy={chartData.toY(sim.minVol.ret)} r={7} fill="#1976d2" stroke="#fff" strokeWidth={2} />
                    <text x={chartData.toX(sim.minVol.vol) + 10} y={chartData.toY(sim.minVol.ret) + 4} fontSize={11} fill="#1976d2">Min Risk</text>
                    {(() => {
                      const cx = chartData.toX(sim.maxSharpe.vol), cy = chartData.toY(sim.maxSharpe.ret), r = 8;
                      const pts = Array.from({ length: 5 }, (_, i) => {
                        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                        const ri = i % 2 === 0 ? r : r * 0.45;
                        return `${cx + ri * Math.cos(a)},${cy + ri * Math.sin(a)}`;
                      }).join(' ');
                      return (<><polygon points={pts} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} /><text x={cx + 12} y={cy + 4} fontSize={11} fill="#b45309">Max Sharpe</text></>);
                    })()}
                    {targetPortfolio && (() => {
                      const cx = chartData.toX(targetPortfolio.vol), cy = chartData.toY(targetPortfolio.ret), s = 8;
                      return (<><polygon points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`} fill="#7c3aed" stroke="#fff" strokeWidth={1.5} /><text x={cx + 11} y={cy + 4} fontSize={11} fill="#7c3aed">Target</text></>);
                    })()}
                    {sim.current && (<>
                      <circle cx={chartData.toX(sim.current.vol)} cy={chartData.toY(sim.current.ret)} r={7} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                      <text x={chartData.toX(sim.current.vol) + 10} y={chartData.toY(sim.current.ret) + 4} fontSize={11} fill="#ef4444">You</text>
                    </>)}
                  </g>
                </svg>
              </Paper>
            </Box>

            {/* ── Right: controls + slider + buy plan ── */}
            <Box sx={{ flex: 1, minWidth: 0 }}>

              {/* Header + controls */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h6">Efficient Frontier</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {SIMULATIONS.toLocaleString()} portfolios · {sim.dataPoints} days
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    label="Risk-free (%/yr)"
                    size="small"
                    value={riskFreeRate}
                    onChange={e => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                    inputProps={{ inputMode: 'decimal', style: { width: 48 } }}
                    sx={{ width: 140 }}
                  />
                  <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={runSimulation}>
                    Re-run
                  </Button>
                </Box>
              </Box>

              {/* Target risk slider */}
              <Box sx={{ mt: 2, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.25 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap', minWidth: 130 }}>
                    Target risk: <b>{(targetVol ?? sim.maxSharpe.vol).toFixed(1)}%</b>
                  </Typography>
                  <Slider
                    min={parseFloat(sim.minVol.vol.toFixed(1))}
                    max={parseFloat((Math.max(sim.maxSharpe.vol * 1.8, (sim.current?.vol ?? 0) * 1.15)).toFixed(1))}
                    step={0.1}
                    value={targetVol ?? sim.maxSharpe.vol}
                    onChange={(_, v) => setTargetVol(v as number)}
                    sx={{ color: '#7c3aed' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">● {sim.minVol.vol.toFixed(1)}% Min Risk</Typography>
                  <Typography variant="caption" color="text.secondary">★ {sim.maxSharpe.vol.toFixed(1)}% Max Sharpe</Typography>
                </Box>
              </Box>

              {/* Analysis chips vs target */}
              {analysis && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, my: 1.5 }}>
                  {[
                    { label: 'Sharpe', from: sim.current!.sharpe.toFixed(2), to: targetPortfolio!.sharpe.toFixed(2), delta: analysis.sharpeDelta, fmt: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}` },
                    { label: 'Volatility', from: `${sim.current!.vol.toFixed(1)}%`, to: `${targetPortfolio!.vol.toFixed(1)}%`, delta: analysis.volDelta, fmt: (d: number) => Math.abs(d) > 0.1 ? `${d >= 0 ? '−' : '+'}${Math.abs(d).toFixed(1)}pp` : '≈ same' },
                    { label: 'Exp. return', from: `${sim.current!.ret.toFixed(1)}%`, to: `${targetPortfolio!.ret.toFixed(1)}%`, delta: analysis.retDelta, fmt: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}pp` },
                  ].map(({ label, from, to, delta, fmt }) => (
                    <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 75 }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 38 }}>{from}</Typography>
                      <Typography variant="caption" color="text.secondary">→</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#7c3aed', minWidth: 38 }}>{to}</Typography>
                      <Chip size="small" label={fmt(delta)}
                        sx={{ height: 18, fontSize: '0.68rem', bgcolor: delta >= 0 ? '#f3e8ff' : '#fee2e2', color: delta >= 0 ? '#6b21a8' : '#7f1d1d', '& .MuiChip-label': { px: 0.75 } }} />
                    </Box>
                  ))}
                </Box>
              )}

              {/* What to buy next */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 2, mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>What to Buy Next</Typography>
                <Typography variant="caption" color="text.secondary">only buys · no selling</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <TextField
                  label="Invest (€)"
                  size="small"
                  value={investAmount}
                  onChange={e => setInvestAmount(e.target.value)}
                  inputProps={{ inputMode: 'decimal' }}
                  sx={{ width: 130 }}
                />
                {targetPortfolio && (
                  <Typography variant="caption" color="text.secondary">
                    vol {targetPortfolio.vol.toFixed(1)}% · ret {targetPortfolio.ret.toFixed(1)}% · sharpe {targetPortfolio.sharpe.toFixed(2)}
                  </Typography>
                )}
              </Box>
              {buyPlan ? (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                        <TableCell>Ticker</TableCell>
                        <TableCell align="right">Now %</TableCell>
                        <TableCell align="right" sx={{ color: '#7c3aed' }}>Target %</TableCell>
                        <TableCell align="right">Buy (€)</TableCell>
                        <TableCell align="right">After %</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {buyPlan.map(row => (
                        <TableRow key={row.ticker} hover>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Tooltip title={nameByTicker[row.ticker] ?? row.ticker} placement="right">
                              <span>{row.ticker}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">{row.currentPct.toFixed(1)}%</TableCell>
                          <TableCell align="right" sx={{ color: '#7c3aed' }}>{row.targetPct.toFixed(1)}%</TableCell>
                          <TableCell align="right">
                            {row.buyAmt > 0.5 ? (
                              <Box sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: '#f3e8ff' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b21a8', whiteSpace: 'nowrap' }}>
                                  ↑ €{Math.round(row.buyAmt).toLocaleString()}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ color: Math.abs(row.resultPct - row.targetPct) < 1 ? 'success.main' : 'text.primary' }}>
                              {row.resultPct.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell colSpan={3} sx={{ fontWeight: 600 }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#6b21a8' }}>€{Math.round(investEuros).toLocaleString()}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">Enter an amount above to see the buy plan.</Alert>
              )}
            </Box>
          </Box>

          {/* ── Portfolio metrics summary (full width below) ──────────────── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {[
              { label: 'Your Portfolio', point: sim.current, color: '#ef4444' },
              { label: '◆ Target', point: targetPortfolio, color: '#7c3aed' },
              { label: '★ Max Sharpe', point: sim.maxSharpe, color: '#f59e0b' },
              { label: '● Min Risk', point: sim.minVol, color: '#1976d2' },
            ]
              .filter(x => x.point != null)
              .map(({ label, point, color }) => (
                <Paper key={label} elevation={0} sx={{ flex: '1 1 140px', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="caption" sx={{ color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">Return: <b>{point!.ret.toFixed(1)}%</b></Typography>
                    <Typography variant="body2">Volatility: <b>{point!.vol.toFixed(1)}%</b></Typography>
                    <Typography variant="body2">Sharpe: <b>{point!.sharpe.toFixed(2)}</b></Typography>
                  </Box>
                </Paper>
              ))}
          </Box>
        </>
      ) : (
        !isLoading && Object.keys(pricesByTicker).length < 2 && (
          <Alert severity="info">
            Need price history for at least 2 holdings to run the optimizer.
            Open each ticker in Tracked Tickers and fetch its historical data first.
          </Alert>
        )
      )}
    </Box>
  );
};

export default PortfolioOptimizer;
