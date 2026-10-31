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
  Button,
  Chip,
  CircularProgress,
  Slider,
  Tooltip,
  Alert,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  useTheme,
  useMediaQuery
} from '@mui/material';

// Below this many trading days, the return/volatility estimates behind the
// frontier are based on a fairly short price history and should be read as
// a rough guide rather than a precise forecast.
const LOW_DATA_THRESHOLD_DAYS = 252;
import { FrontierSim, LimitingHolding, SimPoint } from '../../utils/frontierSim';
import { ReturnMode, frontierReturnAtVol, frontierVolAtReturn, holdingsUsed, newMoneyPlan } from '../../utils/optimizer';
import RefreshIcon from '@mui/icons-material/Refresh';
import FrontierChart from './FrontierChart';
import FrontierInsights from './FrontierInsights';
import CalculationBreakdown from './CalculationBreakdown';

// Tints behind the buy/sell figures. Translucent, so they sit on light and
// dark paper alike; the text on them is the theme's secondary and error.
const VIOLET_TINT = 'rgba(139,92,246,0.14)';
const RED_TINT = 'rgba(239,68,68,0.14)';

interface FrontierSectionProps {
  sim: FrontierSim;
  targetPortfolio: SimPoint | null;
  targetVol: number | null;
  onTargetVolChange: (vol: number) => void;
  riskFreeRate: string;
  onRiskFreeRateChange: (value: string) => void;
  returnMode: ReturnMode;
  onReturnModeChange: (mode: ReturnMode) => void;
  /** The long-run return every holding is assumed to earn, % a year, as typed. */
  anchorPct: string;
  onAnchorPctChange: (value: string) => void;
  /** The most any one holding may weigh, % of the portfolio, as typed. */
  maxWeight: string;
  onMaxWeightChange: (value: string) => void;
  /** Reload the prices and holdings and solve the frontier again. */
  onRefresh: () => void;
  refreshing: boolean;
  /** When the prices behind the frontier were last loaded. */
  updatedAt: Date | null;
  /** The holding whose short history caps the sample, when leaving it out would clearly help. */
  limiting: LimitingHolding | null;
  /** Holdings left out of the frontier. */
  excluded: string[];
  onExclude: (ticker: string) => void;
  onInclude: (ticker: string) => void;
  totalValue: number;
  nameByTicker: Record<string, string>;
}

const MODE_LABELS: Record<ReturnMode, string> = {
  shrunk: 'History, blended with the long run',
  equal: 'All the same, risk decides',
  history: 'History only'
};

const CAP_OPTIONS = ['100', '50', '40', '30', '25'];

/**
 * How far below the frontier counts as close enough. A couple of years of prices
 * cannot tell a mix from its neighbours by less than this, so a smaller gap is not
 * a reason to sell anything, which would also realise tax.
 */
const CLOSE_RETURN_POINTS = 1;
const CLOSE_RISK_POINTS = 2;

const FrontierSection: React.FC<FrontierSectionProps> = ({
  sim,
  targetPortfolio,
  targetVol,
  onTargetVolChange,
  riskFreeRate,
  onRiskFreeRateChange,
  returnMode,
  onReturnModeChange,
  anchorPct,
  onAnchorPctChange,
  maxWeight,
  onMaxWeightChange,
  onRefresh,
  refreshing,
  updatedAt,
  limiting,
  excluded,
  onExclude,
  onInclude,
  totalValue,
  nameByTicker
}) => {
  const [investAmount, setInvestAmount] = useState<string>('1000');
  const investEuros = parseFloat(investAmount) || 0;
  const [rebalanceMode, setRebalanceMode] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // Are you on the frontier? Compare against what the same risk could earn, and
  // what the same return could do with less risk.
  const verdict = useMemo(() => {
    if (!sim.current) return null;
    const best = frontierReturnAtVol(sim.frontier, sim.current.vol);
    const leaner = frontierVolAtReturn(sim.frontier, sim.current.ret);
    return {
      extraReturn: best === null ? null : Math.max(0, best - sim.current.ret),
      lessRisk: leaner === null ? null : Math.max(0, sim.current.vol - leaner),
      bestReturn: best,
      leanerVol: leaner
    };
  }, [sim]);

  // Buy-only plan: how to allocate next investment to move toward target.
  // Rebalance mode additionally allows negative amounts (sells) so the plan
  // can hit the target exactly, even without new money.
  const buyPlan = useMemo(() => {
    if (!sim.current || !targetPortfolio || totalValue <= 0) return null;
    if (!rebalanceMode && investEuros <= 0) return null;
    const tickers = sim.tickers;
    const newTotal = totalValue + investEuros;

    if (rebalanceMode) {
      return tickers.map((ticker, i) => {
        const currentVal = sim.current!.weights[i] * totalValue;
        const targetVal = targetPortfolio.weights[i] * newTotal;
        return {
          ticker,
          currentPct: sim.current!.weights[i] * 100,
          targetPct: targetPortfolio.weights[i] * 100,
          buyAmt: targetVal - currentVal, // positive = buy, negative = sell
          resultPct: targetPortfolio.weights[i] * 100
        };
      });
    }

    const currentValues = tickers.map((_, i) => sim.current!.weights[i] * totalValue);
    const purchases = newMoneyPlan(currentValues, targetPortfolio.weights, investEuros);
    return tickers.map((ticker, i) => ({
      ticker,
      currentPct: sim.current!.weights[i] * 100,
      targetPct: targetPortfolio.weights[i] * 100,
      buyAmt: purchases[i],
      resultPct: ((currentValues[i] + purchases[i]) / newTotal) * 100
    }));
  }, [sim, targetPortfolio, investEuros, totalValue, rebalanceMode]);

  return (
    <>
      {/* Header + assumptions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6">Efficient Frontier</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Solved, long-only · {sim.dataPoints} {sim.breakdown.basis} returns
            {sim.dataPoints < LOW_DATA_THRESHOLD_DAYS && sim.breakdown.basis === 'daily' && (
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
                {' '}· based on limited history, treat as a rough guide
              </Box>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {updatedAt && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Typography>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={onRefresh}
            disabled={refreshing}
            startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
          >
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Expected returns</InputLabel>
          <Select
            label="Expected returns"
            value={returnMode}
            onChange={(e) => onReturnModeChange(e.target.value as ReturnMode)}
          >
            {(Object.keys(MODE_LABELS) as ReturnMode[]).map((mode) => (
              <MenuItem key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {returnMode !== 'history' && (
          <TextField
            label="Long-run return (%/yr)"
            size="small"
            value={anchorPct}
            onChange={(e) => onAnchorPctChange(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            sx={{ width: 170 }}
          />
        )}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Max per holding</InputLabel>
          <Select label="Max per holding" value={maxWeight} onChange={(e) => onMaxWeightChange(e.target.value)}>
            {CAP_OPTIONS.map((cap) => (
              <MenuItem key={cap} value={cap}>
                {cap === '100' ? 'No limit' : `${cap}%`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Risk-free (%/yr)"
          size="small"
          value={riskFreeRate}
          onChange={(e) => onRiskFreeRateChange(e.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ width: 140 }}
        />
      </Box>

      {limiting && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => onExclude(limiting.ticker)}>
              Leave out {limiting.ticker}
            </Button>
          }
        >
          The history here is {limiting.yearsWith.toFixed(1)} years because {limiting.ticker} only has prices since{' '}
          {limiting.since}. Without it the other funds share {limiting.yearsWithout.toFixed(1)} years, which makes the
          rest of the frontier more reliable.
        </Alert>
      )}

      {excluded.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Left out, so their money is not in the plan below:
          </Typography>
          {excluded.map((ticker) => (
            <Chip key={ticker} size="small" label={ticker} onDelete={() => onInclude(ticker)} />
          ))}
        </Box>
      )}

      {returnMode === 'history' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          History only is the noisiest way to run this. The weights below lean on whatever did best in the window,
          so read them as a description of the past, not a recommendation.
        </Alert>
      )}

      {targetPortfolio && sim.tickers.length >= 4 && holdingsUsed(targetPortfolio.weights) <= 2 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          The target uses only {holdingsUsed(targetPortfolio.weights)} of your {sim.tickers.length} funds. An
          optimizer favours a few funds that move differently from each other, and a fund that already holds a bit
          of everything can look redundant next to them. Set a max per holding to see a spread.
        </Alert>
      )}

      {verdict && sim.current && (() => {
        const extra = verdict.extraReturn ?? 0;
        const less = verdict.lessRisk ?? 0;
        const close = extra < CLOSE_RETURN_POINTS && less < CLOSE_RISK_POINTS;
        const gaps = [
          extra >= 0.1 && verdict.bestReturn !== null
            ? `The same risk could earn ${verdict.bestReturn.toFixed(1)}% (+${extra.toFixed(1)} points)`
            : null,
          less >= 0.1 && verdict.leanerVol !== null
            ? `the same return needs ${verdict.leanerVol.toFixed(1)}% risk (${less.toFixed(1)} points less)`
            : null
        ].filter(Boolean);
        return (
          <Alert severity={close ? 'success' : 'info'} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {close ? 'You are close to the frontier.' : 'You are below the frontier.'}
            </Typography>
            <Typography variant="body2">
              You hold {sim.current.vol.toFixed(1)}% risk for {sim.current.ret.toFixed(1)}% expected return.
              {gaps.length > 0 && <> {gaps.join(', or ')}.</>}{' '}
              {close
                ? 'That gap is smaller than this much history can tell apart, so there is no case for rebalancing.'
                : 'That is a gap worth closing, and new money is the cheapest way to start.'}
            </Typography>
          </Alert>
        );
      })()}

      {/* Target risk slider — full width, above the chart */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.25 }}>
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap', minWidth: 130 }}>
            Target risk: <b>{(targetVol ?? sim.maxSharpe.vol).toFixed(1)}%</b>
          </Typography>
          <Slider
            min={parseFloat(sim.minVol.vol.toFixed(1))}
            max={Math.ceil(Math.max(sim.frontier[sim.frontier.length - 1].vol, sim.maxSharpe.vol) * 10) / 10}
            step={0.1}
            value={targetVol ?? sim.maxSharpe.vol}
            onChange={(_, v) => onTargetVolChange(v as number)}
            sx={{ color: 'secondary.main', flex: 1 }}
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

      {/* Two-column layout: chart left, analysis + buy plan right */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>

        {/* ── Left: chart ── */}
        <Box sx={{ flex: { xs: '1 1 auto', md: '0 0 55%' }, minWidth: 0, width: '100%' }}>
          <FrontierChart sim={sim} targetPortfolio={targetPortfolio} />
        </Box>

        {/* ── Right: analysis + buy plan ── */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>

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
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main', minWidth: 38 }}>{to}</Typography>
                  <Chip size="small" label={fmt(delta)}
                    sx={{ height: 18, fontSize: '0.68rem', bgcolor: delta >= 0 ? VIOLET_TINT : RED_TINT, color: delta >= 0 ? 'secondary.main' : 'error.main', '& .MuiChip-label': { px: 0.75 } }} />
                </Box>
              ))}
            </Box>
          )}

          {/* What to buy next */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 2, mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>What to Buy Next</Typography>
            <FormControlLabel
              sx={{ m: 0 }}
              control={<Switch size="small" checked={rebalanceMode} onChange={e => setRebalanceMode(e.target.checked)} />}
              label={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Rebalance (buy + sell)</Typography>}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
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
            isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {buyPlan.map(row => (
                  <Paper key={row.ticker} elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Tooltip title={nameByTicker[row.ticker] ?? row.ticker} placement="right">
                        <Typography sx={{ fontWeight: 600 }}>{row.ticker}</Typography>
                      </Tooltip>
                      {row.buyAmt > 0.5 ? (
                        <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: VIOLET_TINT }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main', whiteSpace: 'nowrap' }}>
                            ↑ €{Math.round(row.buyAmt).toLocaleString()}
                          </Typography>
                        </Box>
                      ) : row.buyAmt < -0.5 ? (
                        <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: RED_TINT }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'error.main', whiteSpace: 'nowrap' }}>
                            ↓ €{Math.round(Math.abs(row.buyAmt)).toLocaleString()}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>No change</Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mt: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Now</Typography>
                        <Typography variant="body2">{row.currentPct.toFixed(1)}%</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Target</Typography>
                        <Typography variant="body2" sx={{ color: 'secondary.main' }}>{row.targetPct.toFixed(1)}%</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>After</Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: Math.abs(row.resultPct - row.targetPct) < 1 ? 'success.main' : 'text.primary' }}
                        >
                          {row.resultPct.toFixed(1)}%
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 600 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 700, color: 'secondary.main' }}>€{Math.round(investEuros).toLocaleString()}</Typography>
                </Paper>
              </Box>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                      <TableCell>Ticker</TableCell>
                      <TableCell align="right">Now %</TableCell>
                      <TableCell align="right" sx={{ color: 'secondary.main' }}>Target %</TableCell>
                      <TableCell align="right">{rebalanceMode ? 'Buy/Sell (€)' : 'Buy (€)'}</TableCell>
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
                        <TableCell align="right" sx={{ color: 'secondary.main' }}>{row.targetPct.toFixed(1)}%</TableCell>
                        <TableCell align="right">
                          {row.buyAmt > 0.5 ? (
                            <Box sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: VIOLET_TINT }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main', whiteSpace: 'nowrap' }}>
                                ↑ €{Math.round(row.buyAmt).toLocaleString()}
                              </Typography>
                            </Box>
                          ) : row.buyAmt < -0.5 ? (
                            <Box sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: RED_TINT }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'error.main', whiteSpace: 'nowrap' }}>
                                ↓ €{Math.round(Math.abs(row.buyAmt)).toLocaleString()}
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
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'secondary.main' }}>€{Math.round(investEuros).toLocaleString()}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )
          ) : (
            <Alert severity="info">Enter an amount above to see the buy plan.</Alert>
          )}
        </Box>
      </Box>

      <FrontierInsights sim={sim} targetPortfolio={targetPortfolio} nameByTicker={nameByTicker} />

      {/* ── Portfolio metrics summary (full width below) ──────────────── */}
      {/* CSS Grid with minmax(0, 1fr) tracks — unlike flex-wrap + flex-basis,
          this can't be forced wider than the viewport by a card's content. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
        {[
          { label: 'Your Portfolio', point: sim.current, color: '#ef4444' },
          { label: '◆ Target', point: targetPortfolio, color: 'secondary.main' },
          { label: '★ Max Sharpe', point: sim.maxSharpe, color: '#f59e0b' },
          { label: '● Min Risk', point: sim.minVol, color: '#1976d2' },
        ]
          .filter(x => x.point != null)
          .map(({ label, point, color }) => (
            <Paper key={label} elevation={0} sx={{ minWidth: 0, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">Expected return: <b>{point!.ret.toFixed(1)}%</b></Typography>
                <Typography variant="body2">Volatility: <b>{point!.vol.toFixed(1)}%</b></Typography>
                <Typography variant="body2">Sharpe: <b>{point!.sharpe.toFixed(2)}</b></Typography>
              </Box>
            </Paper>
          ))}
      </Box>

      {/*
        Directly under the cards whose numbers it explains. The estimate carries
        an error bar wide enough to matter on a short sample, and a percentage
        with no working shown gives the reader no way to notice that.
      */}
      <CalculationBreakdown sim={sim} nameByTicker={nameByTicker} />
    </>
  );
};

export default FrontierSection;
