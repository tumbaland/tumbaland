import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { TableChart, TrendingUp } from '@mui/icons-material';
import StockGrowthChart from '../StockGrowthChart';
import { usePersistedState } from '../../hooks/usePersistedState';
import { FrontierSim, SimPoint } from '../../utils/frontierSim';
import {
  LONG_RUN_RETURN_PCT,
  McBands,
  ProjectionParams,
  SCENARIO_PRESETS,
  YearlyProjection,
  projectDeterministic,
  runMonteCarloBands,
  shrinkExpectedReturn,
  yearsToGoal
} from '../../utils/growthProjection';

const MC_SIMULATIONS = 1000;
const DEBOUNCE_MS = 250;
const MAX_YEARS = 50;

type PlanSource = 'target' | 'current' | 'maxSharpe' | 'minVol';

// Smaller, denser fields for a compact, single-column form.
const compactFieldSx = {
  '& .MuiInputBase-input': { fontSize: '0.8rem' },
  '& .MuiInputLabel-root': { fontSize: '0.8rem' }
};

interface ProjectionSectionProps {
  sim: FrontierSim | null;
  targetPortfolio: SimPoint | null;
  portfolioValue: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('et-EE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);

const ProjectionSection: React.FC<ProjectionSectionProps> = ({ sim, targetPortfolio, portfolioValue }) => {
  // Text inputs stay strings so the user can clear a field while typing;
  // parsing happens once, when building the projection params. Persisted
  // (except starting capital, which follows the real portfolio value) so a
  // returning user's plan doesn't reset on every visit.
  const [startingCapital, setStartingCapital] = useState('1000');
  const [contribution, setContribution] = usePersistedState('finance-planner-contribution', '500');
  const [years, setYears] = usePersistedState('finance-planner-years', '30');
  const [goal, setGoal] = usePersistedState('finance-planner-goal', '');
  const [inflation, setInflation] = usePersistedState('finance-planner-inflation', '2.5');

  // Collapsed by default — up to 50 rows is the single biggest contributor
  // to the page's scroll length, and most people just want the chart above.
  const [showYearlyTable, setShowYearlyTable] = useState(false);

  const [source, setSource] = usePersistedState<PlanSource>('finance-planner-source', 'target');
  // A returning user's saved basis should stick rather than being immediately
  // overwritten by the "follow the real portfolio" effect below.
  const sourceTouched = useRef(localStorage.getItem('finance-planner-source') !== null);
  const capitalTouched = useRef(false);

  // Fallback assumptions when there's no price history to derive a basis from.
  const [growth, setGrowth] = usePersistedState('finance-planner-growth', String(SCENARIO_PRESETS.base.growth));
  const [volatility, setVolatility] = usePersistedState('finance-planner-volatility', String(SCENARIO_PRESETS.base.volatility));

  // Follow the real portfolio: default the projection to the frontier target
  // and the starting capital to the actual portfolio value, until the user
  // overrides either by hand.
  useEffect(() => {
    if (sim && !sourceTouched.current) setSource(sim.current ? 'current' : 'target');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);
  useEffect(() => {
    if (portfolioValue > 0 && !capitalTouched.current) {
      setStartingCapital(String(Math.round(portfolioValue)));
    }
  }, [portfolioValue]);

  const basisPoint: SimPoint | null = useMemo(() => {
    if (!sim) return null;
    if (source === 'current') return sim.current;
    if (source === 'maxSharpe') return sim.maxSharpe;
    if (source === 'minVol') return sim.minVol;
    return targetPortfolio;
  }, [sim, source, targetPortfolio]);

  // A history-derived expected return gets shrunk toward the long-run anchor
  // before driving a multi-decade projection — see shrinkExpectedReturn.
  const growthPct = basisPoint && sim
    ? shrinkExpectedReturn(basisPoint.ret, sim.dataPoints)
    : parseFloat(growth);
  const volatilityPct = basisPoint ? basisPoint.vol : parseFloat(volatility);

  const params: ProjectionParams | null = useMemo(() => {
    const capital = parseFloat(startingCapital);
    const yrs = Math.min(MAX_YEARS, parseInt(years, 10) || 0);
    if (!(capital > 0) || yrs < 1 || !isFinite(growthPct) || !isFinite(volatilityPct)) return null;
    return {
      startingCapital: capital,
      monthlyContribution: parseFloat(contribution) || 0,
      years: yrs,
      expectedAnnualReturnPct: growthPct,
      annualVolatilityPct: volatilityPct,
      annualInflationPct: parseFloat(inflation) || 0,
      annualFeePct: 0
    };
  }, [startingCapital, contribution, years, growthPct, volatilityPct, inflation]);

  const [rows, setRows] = useState<YearlyProjection[]>([]);
  const [bands, setBands] = useState<McBands | null>(null);

  // Debounced recompute: the Monte Carlo run is too heavy to fire per keystroke
  useEffect(() => {
    if (!params) return;
    const t = setTimeout(() => {
      setRows(projectDeterministic(params));
      setBands(runMonteCarloBands(params, MC_SIMULATIONS));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [params]);

  const finalRow = rows[rows.length - 1];
  const goalNum = parseFloat(goal);
  const goalValue = goalNum > 0 ? goalNum : undefined;
  const goalYear = goalValue ? yearsToGoal(rows, goalValue) : undefined;
  const finalP10 = bands ? bands.p10[bands.p10.length - 1] : null;
  const finalP50 = bands ? bands.p50[bands.p50.length - 1] : null;
  const finalP90 = bands ? bands.p90[bands.p90.length - 1] : null;

  const downloadCSV = () => {
    if (rows.length === 0) return;
    const csv = [
      ['Year', 'Money Invested', 'Gain from Market', 'Portfolio Total Value', 'Inflation Adjusted Value']
    ];
    rows.forEach(r => csv.push([
      r.year.toString(),
      Math.round(r.moneyInvested).toString(),
      Math.round(r.gainFromMarket).toString(),
      Math.round(r.portfolioTotalValue).toString(),
      Math.round(r.inflationAdjustedValue).toString()
    ]));
    const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'growth-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summaryItems = finalRow
    ? [
        { label: 'Total Invested', value: formatCurrency(finalRow.moneyInvested), color: 'text.primary' },
        { label: 'Expected Value', value: formatCurrency(finalRow.portfolioTotalValue), color: 'primary.main' },
        ...(finalP50 != null ? [{ label: 'Median (Monte Carlo)', value: formatCurrency(finalP50), color: 'text.primary' }] : []),
        ...(finalP10 != null && finalP90 != null
          ? [{ label: 'Likely Range (p10–p90)', value: `${formatCurrency(finalP10)} – ${formatCurrency(finalP90)}`, color: 'text.secondary' }]
          : []),
        { label: 'Inflation Adjusted', value: formatCurrency(finalRow.inflationAdjustedValue), color: 'warning.main' },
        {
          label: 'Return on Investment',
          value: `${((finalRow.gainFromMarket / finalRow.moneyInvested) * 100).toFixed(1)}%`,
          color: 'success.main'
        },
        ...(goalValue !== undefined
          ? [{ label: 'Years to Goal', value: goalYear ? `${goalYear} years` : 'Not reached', color: goalYear ? 'primary.main' : 'text.secondary' }]
          : [])
      ]
    : [];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUp sx={{ mr: 1 }} />
          Growth Projection
        </Typography>

        {/* All choices stacked in a single compact column. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1.5, maxWidth: 360 }}>
          <TextField
            label="Starting Capital (EUR)"
            type="number"
            size="small"
            value={startingCapital}
            onChange={e => {
              capitalTouched.current = true;
              setStartingCapital(e.target.value);
            }}
            fullWidth
            sx={compactFieldSx}
            slotProps={{ htmlInput: { min: 0, step: 100 } }}
            helperText={portfolioValue > 0 ? 'Defaults to your portfolio value' : undefined}
          />
          <TextField
            label="Monthly Contribution (EUR)"
            type="number"
            size="small"
            value={contribution}
            onChange={e => setContribution(e.target.value)}
            fullWidth
            sx={compactFieldSx}
            slotProps={{ htmlInput: { min: 0, step: 50 } }}
          />
          <TextField
            label="Investment Period (Years)"
            type="number"
            size="small"
            value={years}
            onChange={e => setYears(e.target.value)}
            fullWidth
            sx={compactFieldSx}
            slotProps={{ htmlInput: { min: 1, max: MAX_YEARS } }}
          />
          <TextField
            label="Target Goal (EUR)"
            type="number"
            size="small"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            fullWidth
            sx={compactFieldSx}
            slotProps={{ htmlInput: { min: 0, step: 500 } }}
            helperText="Optional goal line on the chart"
          />

          {sim && (
            <FormControl fullWidth size="small" sx={compactFieldSx}>
              <InputLabel>Projection Basis</InputLabel>
              <Select
                label="Projection Basis"
                value={source}
                onChange={e => {
                  sourceTouched.current = true;
                  setSource(e.target.value as PlanSource);
                }}
              >
                <MenuItem value="target">Target (risk slider)</MenuItem>
                {sim.current && <MenuItem value="current">Current portfolio</MenuItem>}
                <MenuItem value="maxSharpe">Max Sharpe</MenuItem>
                <MenuItem value="minVol">Min Risk</MenuItem>
              </Select>
            </FormControl>
          )}
          {!sim && (
            <>
              <TextField
                label="Growth (%)"
                type="number"
                size="small"
                value={growth}
                onChange={e => setGrowth(e.target.value)}
                fullWidth
                sx={compactFieldSx}
                slotProps={{ htmlInput: { min: 0, max: 50, step: 0.1 } }}
              />
              <TextField
                label="Volatility (%)"
                type="number"
                size="small"
                value={volatility}
                onChange={e => setVolatility(e.target.value)}
                fullWidth
                sx={compactFieldSx}
                slotProps={{ htmlInput: { min: 0, max: 80, step: 0.5 } }}
              />
            </>
          )}

          <TextField
            label="Inflation (%)"
            type="number"
            size="small"
            value={inflation}
            onChange={e => setInflation(e.target.value)}
            fullWidth
            sx={compactFieldSx}
            slotProps={{ htmlInput: { min: 0, max: 20, step: 0.1 } }}
          />

          {basisPoint && sim && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Assumes <b>{growthPct.toFixed(1)}%</b> expected return · <b>{basisPoint.vol.toFixed(1)}%</b> volatility —{' '}
              {basisPoint.ret.toFixed(1)}% annualized, derived from your holdings&apos; price history
              ({sim.dataPoints} trading days) and shrunk toward a long-run {LONG_RUN_RETURN_PCT}% to
              avoid extrapolating a short sample
            </Typography>
          )}
        </Box>

        {/* Summary — CSS Grid with minmax(0, 1fr) tracks so a wide value (e.g.
            the p10-p90 range) can never force the row wider than the
            viewport the way flex-wrap + flex-basis could. */}
        {finalRow && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(150px, 1fr))' },
              gap: 2,
              mt: 2
            }}
          >
            {summaryItems.map(item => (
              <Paper key={item.label} elevation={0} sx={{ minWidth: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>{item.label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: item.color, overflowWrap: 'break-word' }}>{item.value}</Typography>
              </Paper>
            ))}
          </Box>
        )}

        {/* Chart */}
        {rows.length > 0 && (
          <Box sx={{ mt: 3, minWidth: 0 }}>
            <StockGrowthChart data={rows} goal={goalValue} mcBands={bands || undefined} />
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              The blue line is the expected (average) compound path; the shaded band spans the 10th–90th percentile of{' '}
              {MC_SIMULATIONS.toLocaleString()} Monte Carlo simulations with fat-tailed (Student&apos;s t) monthly returns,
              so its median sits below the average path — that is expected, not a bug.
            </Typography>
          </Box>
        )}

        {/* Yearly table */}
        {rows.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', m: 0 }}>
                <TableChart sx={{ mr: 1 }} />
                Detailed Yearly Breakdown
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="text" size="small" onClick={() => setShowYearlyTable(v => !v)}>
                  {showYearlyTable ? 'Hide table' : 'Show table'}
                </Button>
                <Button variant="outlined" size="small" onClick={downloadCSV}>Download CSV</Button>
              </Box>
            </Box>

            <Collapse in={showYearlyTable} timeout="auto">
              <TableContainer component={Paper} sx={{ maxHeight: 600, mt: 2 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Money Invested</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Gain from Market</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Portfolio Total Value</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Inflation Adjusted Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow key={row.year} hover>
                        <TableCell sx={{ fontWeight: 'medium' }}>{row.year}</TableCell>
                        <TableCell align="right">{formatCurrency(row.moneyInvested)}</TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: row.gainFromMarket >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 'medium'
                          }}
                        >
                          {formatCurrency(row.gainFromMarket)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'medium' }}>
                          {formatCurrency(row.portfolioTotalValue)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 'medium' }}>
                          {formatCurrency(row.inflationAdjustedValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Note:</strong> Projections assume monthly contributions and compounding. Real market
                  performance will vary significantly year to year. Results are for educational purposes only and
                  should not be considered as investment advice.
                </Typography>
              </Alert>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectionSection;
