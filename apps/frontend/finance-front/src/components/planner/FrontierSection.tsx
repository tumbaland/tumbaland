import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
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
  Tooltip,
  Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { FrontierSim, SimPoint } from '../../utils/frontierSim';
import FrontierChart from './FrontierChart';

interface FrontierSectionProps {
  sim: FrontierSim;
  targetPortfolio: SimPoint | null;
  targetVol: number | null;
  onTargetVolChange: (vol: number) => void;
  riskFreeRate: string;
  onRiskFreeRateChange: (value: string) => void;
  onRerun: () => void;
  totalValue: number;
  nameByTicker: Record<string, string>;
  simulations: number;
}

const FrontierSection: React.FC<FrontierSectionProps> = ({
  sim,
  targetPortfolio,
  targetVol,
  onTargetVolChange,
  riskFreeRate,
  onRiskFreeRateChange,
  onRerun,
  totalValue,
  nameByTicker,
  simulations
}) => {
  const [investAmount, setInvestAmount] = useState<string>('1000');
  const investEuros = parseFloat(investAmount) || 0;

  // Analysis: deltas between current portfolio and target
  const analysis = useMemo(() => {
    if (!sim.current || !targetPortfolio) return null;
    const c = sim.current;
    return {
      sharpeDelta: targetPortfolio.sharpe - c.sharpe,
      volDelta: c.vol - targetPortfolio.vol, // positive = target is less volatile
      retDelta: targetPortfolio.ret - c.ret
    };
  }, [sim, targetPortfolio]);

  // Buy-only plan: how to allocate next investment to move toward target
  const buyPlan = useMemo(() => {
    if (!sim.current || !targetPortfolio || totalValue <= 0 || investEuros <= 0) return null;
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
        resultPct: ((currentVal + buyAmt) / newTotal) * 100
      };
    });
  }, [sim, targetPortfolio, investEuros, totalValue]);

  return (
    <>
      {/* Two-column layout: chart left, controls + table right */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>

        {/* ── Left: chart ── */}
        <Box sx={{ flex: { xs: '1 1 auto', md: '0 0 55%' }, minWidth: 0, width: '100%' }}>
          <FrontierChart sim={sim} targetPortfolio={targetPortfolio} />
        </Box>

        {/* ── Right: controls + slider + buy plan ── */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>

          {/* Header + controls */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6">Efficient Frontier</Typography>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
                {simulations.toLocaleString()} portfolios · {sim.dataPoints} days
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                label="Risk-free (%/yr)"
                size="small"
                value={riskFreeRate}
                onChange={e => onRiskFreeRateChange(e.target.value)}
                slotProps={{ htmlInput: { inputMode: 'decimal', style: { width: 48 } } }}
                sx={{ width: 140 }}
              />
              <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={onRerun}>
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
                onChange={(_, v) => onTargetVolChange(v as number)}
                sx={{ color: '#7c3aed' }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>● {sim.minVol.vol.toFixed(1)}% Min Risk</Typography>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>★ {sim.maxSharpe.vol.toFixed(1)}% Max Sharpe</Typography>
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
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      minWidth: 75
                    }}>{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 38 }}>{from}</Typography>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>→</Typography>
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
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>only buys · no selling</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <TextField
              label="Invest (€)"
              size="small"
              value={investAmount}
              onChange={e => setInvestAmount(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              sx={{ width: 130 }}
            />
            {targetPortfolio && (
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>
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
                          <Typography variant="caption" sx={{
                            color: "text.secondary"
                          }}>—</Typography>
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
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
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
  );
};

export default FrontierSection;
