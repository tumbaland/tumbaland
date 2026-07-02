import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert
} from '@mui/material';
import { Calculate, TableChart } from '@mui/icons-material';
import StockGrowthChart from '../components/StockGrowthChart';

interface CalculationInput {
  startingCapital: number;
  expectedGrowth: number;
  annualInvestment: number;
  maxYears: number;
  expectedInflation: number;
  contributionFrequency: 'annual' | 'monthly';
  monthlyInvestment: number;
  compounding: 'annual' | 'monthly';
  annualFee: number; // expense ratio or drag
  targetGoal: number;
  enableMonteCarlo: boolean;
  annualVolatility: number; // %
  numSimulations: number;
  preset: 'custom' | 'conservative' | 'base' | 'aggressive';
  distribution: 'normal' | 'studentT' | 'mixture';
  studentTDegrees: number;
  mixtureKurtosis: number; // weight on fat tail shock
}

interface YearlyResult {
  year: number;
  moneyInvested: number;
  gainFromMarket: number;
  portfolioTotalValue: number;
  inflationAdjustedValue: number;
}

const StockGrowthCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<CalculationInput>({
    startingCapital: 1000,
    expectedGrowth: 10,
    annualInvestment: 6000,
    maxYears: 30,
  expectedInflation: 2.5,
  contributionFrequency: 'annual',
  monthlyInvestment: 500,
  compounding: 'annual',
  annualFee: 0.0,
    targetGoal: 0,
    enableMonteCarlo: false,
    annualVolatility: 15,
    numSimulations: 1000,
  preset: 'custom',
  distribution: 'normal',
  studentTDegrees: 5,
  mixtureKurtosis: 0.1
  });

  const [results, setResults] = useState<YearlyResult[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [mcBands, setMcBands] = useState<{
    years: number[];
    p10: number[];
    p50: number[];
    p90: number[];
  } | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const calculateGrowth = () => {
    const yearlyResults: YearlyResult[] = [];
    let totalInvested = inputs.startingCapital;
    let portfolioValue = inputs.startingCapital;

    const g = inputs.expectedGrowth / 100;
    const f = inputs.annualFee / 100;
    const netAnnual = (1 + g) * (1 - f) - 1; // combine growth and fee multiplicatively
    const netMonthly = Math.pow(1 + netAnnual, 1 / 12) - 1;

    if (inputs.compounding === 'annual' && inputs.contributionFrequency === 'annual') {
      for (let year = 1; year <= inputs.maxYears; year++) {
        if (year > 1) {
          totalInvested += inputs.annualInvestment;
          portfolioValue += inputs.annualInvestment;
        }
        portfolioValue *= 1 + netAnnual;
        const gainFromMarket = portfolioValue - totalInvested;
        const inflationAdjustedValue = portfolioValue / Math.pow(1 + inputs.expectedInflation / 100, year);
        yearlyResults.push({
          year,
          moneyInvested: totalInvested,
          gainFromMarket,
          portfolioTotalValue: portfolioValue,
          inflationAdjustedValue
        });
      }
    } else {
      // Monthly simulation to support monthly compounding and/or contributions
      const totalMonths = inputs.maxYears * 12;
      for (let m = 1; m <= totalMonths; m++) {
        const monthIndex = m - 1;
        const isStartOfYear = monthIndex % 12 === 0;
        // Contributions
        if (inputs.contributionFrequency === 'monthly') {
          totalInvested += inputs.monthlyInvestment;
          portfolioValue += inputs.monthlyInvestment;
        } else {
          if (isStartOfYear && m > 1) {
            totalInvested += inputs.annualInvestment;
            portfolioValue += inputs.annualInvestment;
          }
        }
        // Growth
        if (inputs.compounding === 'monthly') {
          portfolioValue *= 1 + netMonthly;
        } else {
          // annual compounding but monthly contributions; apply growth at end of each year
          if ((m % 12) === 0) {
            portfolioValue *= 1 + netAnnual;
          }
        }
        // End of year snapshot
        if (m % 12 === 0) {
          const year = m / 12;
          const gainFromMarket = portfolioValue - totalInvested;
          const inflationAdjustedValue = portfolioValue / Math.pow(1 + inputs.expectedInflation / 100, year);
          yearlyResults.push({ year, moneyInvested: totalInvested, gainFromMarket, portfolioTotalValue: portfolioValue, inflationAdjustedValue });
        }
      }
    }

    setResults(yearlyResults);
    setIsCalculated(true);
  };

  const handleInputChange = (field: keyof CalculationInput) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(event.target.value) || 0;
    setInputs(prev => ({ ...prev, [field]: value }));
    setIsCalculated(false);
  };

  const handleReset = () => {
    setInputs({
      startingCapital: 1000,
      expectedGrowth: 10,
      annualInvestment: 6000,
      maxYears: 30,
  expectedInflation: 2.5,
  contributionFrequency: 'annual',
  monthlyInvestment: 500,
  compounding: 'annual',
  annualFee: 0.0,
      targetGoal: 0,
      enableMonteCarlo: false,
      annualVolatility: 15,
      numSimulations: 1000,
  preset: 'custom',
  distribution: 'normal',
  studentTDegrees: 5,
  mixtureKurtosis: 0.1
    });
    setResults([]);
    setIsCalculated(false);
    setMcBands(null);
  };

  // Auto-calculate when inputs change
  useEffect(() => {
    if (inputs.startingCapital > 0 && inputs.maxYears > 0) {
      calculateGrowth();
      if (inputs.enableMonteCarlo) {
        runMonteCarlo();
      } else {
        setMcBands(null);
      }
    }
  }, [inputs]);

  const finalResult = results[results.length - 1];
  const goal = inputs.targetGoal > 0 ? inputs.targetGoal : undefined;
  const yearsToGoal = goal
    ? results.find((r) => r.portfolioTotalValue >= goal)?.year
    : undefined;

  const downloadCSV = () => {
    if (results.length === 0) return;
    const rows = [
      ['Year','Money Invested','Gain from Market','Portfolio Total Value','Inflation Adjusted Value']
    ];
    results.forEach(r => rows.push([
      r.year.toString(),
      Math.round(r.moneyInvested).toString(),
      Math.round(r.gainFromMarket).toString(),
      Math.round(r.portfolioTotalValue).toString(),
      Math.round(r.inflationAdjustedValue).toString()
    ]));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'growth-results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const applyPreset = (preset: CalculationInput['preset']) => {
    if (preset === 'conservative') {
      setInputs((p) => ({ ...p, preset, expectedGrowth: 6, annualVolatility: 10 }));
    } else if (preset === 'base') {
      setInputs((p) => ({ ...p, preset, expectedGrowth: 8, annualVolatility: 15 }));
    } else if (preset === 'aggressive') {
      setInputs((p) => ({ ...p, preset, expectedGrowth: 12, annualVolatility: 25 }));
    } else {
      setInputs((p) => ({ ...p, preset }));
    }
  };

  const runMonteCarlo = () => {
    const years = inputs.maxYears;
    const sims = Math.max(10, Math.min(5000, Math.floor(inputs.numSimulations)));
    const monthly = inputs.compounding === 'monthly' || inputs.contributionFrequency === 'monthly';
    const dt = monthly ? 1 / 12 : 1; // time step in years
    const stepsPerYear = monthly ? 12 : 1;

    const mu = inputs.expectedGrowth / 100; // expected annual
    const sigmaA = Math.max(0, inputs.annualVolatility) / 100; // annual vol
    const sigmaStep = sigmaA * Math.sqrt(dt);
    const annualFee = inputs.annualFee / 100;
    const feeFactorAnnual = 1 - annualFee;
    const feeFactorStep = monthly ? Math.pow(feeFactorAnnual, 1 / 12) : feeFactorAnnual;

    const contribAnnual = inputs.annualInvestment;
    const contribMonthly = inputs.monthlyInvestment;

    const allPaths: number[][] = Array.from({ length: sims }, () => Array(years).fill(0));

    // Precompute normal randoms in chunks for performance
    const randn = () => {
      // Box-Muller
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    const randStudentT = (df: number) => {
      // Student's t: Z / sqrt(U/df) where Z ~ N(0,1), U ~ Chi-square(df)
      // Approximate Chi-square(df) via sum of squared normals
      const z = randn();
      let chi2 = 0;
      const k = Math.max(1, Math.floor(df));
      for (let i = 0; i < k; i++) {
        const zi = randn();
        chi2 += zi * zi;
      }
      const t = z / Math.sqrt(chi2 / k);
      return t;
    };

    const shockSample = () => {
      if (inputs.distribution === 'normal') return randn();
      if (inputs.distribution === 'studentT') return randStudentT(inputs.studentTDegrees);
      // mixture: with mixtureKurtosis prob, draw a 3-sigma shock else normal
      const pFat = Math.min(0.9, Math.max(0, inputs.mixtureKurtosis));
      if (Math.random() < pFat) {
        const sign = Math.random() < 0.5 ? -1 : 1;
        return sign * (2.5 + Math.random() * 1.5); // 2.5σ to 4σ shock
      }
      return randn();
    };

    for (let s = 0; s < sims; s++) {
      let value = inputs.startingCapital;
      for (let y = 1; y <= years; y++) {
        for (let m = 1; m <= stepsPerYear; m++) {
          // Contribution at step
          if (inputs.contributionFrequency === 'monthly') {
            value += contribMonthly;

          } else if (m === 1 && !(y === 1 && stepsPerYear === 1)) {
            // annual contribution at start of each year (except first already included)
            value += contribAnnual;

          }
          // GBM step with fee
          const drift = (mu - 0.5 * sigmaA * sigmaA) * dt;
          const shock = sigmaStep * shockSample();
          const stepFactor = Math.exp(drift + shock) * feeFactorStep;
          value *= stepFactor;
        }
        allPaths[s][y - 1] = value; // record end of year
      }
    }

    // Compute percentiles per year
    const p = (arr: number[], q: number) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      } else {
        return sorted[base];
      }
    };

    const yearsArr: number[] = [];
    const p10: number[] = [];
    const p50: number[] = [];
    const p90: number[] = [];
    for (let y = 1; y <= years; y++) {
      const vals = allPaths.map((row) => row[y - 1]);
      yearsArr.push(y);
      p10.push(p(vals, 0.10));
      p50.push(p(vals, 0.50));
      p90.push(p(vals, 0.90));
    }
    setMcBands({ years: yearsArr, p10, p50, p90 });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
        Stock Market Growth Calculator
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Input Form */}
        <Box sx={{ flex: { xs: 1, md: '0 0 400px' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Calculate sx={{ mr: 1 }} />
                Calculation Parameters
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <TextField
                  label="Starting Capital (EUR)"
                  type="number"
                  value={inputs.startingCapital}
                  onChange={handleInputChange('startingCapital')}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: 100 } }}
                />

                <TextField
                  label="Expected Annual Growth (%)"
                  type="number"
                  value={inputs.expectedGrowth}
                  onChange={handleInputChange('expectedGrowth')}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, max: 50, step: 0.1 } }}
                />

                <FormControl fullWidth>
                  <InputLabel>Scenario Preset</InputLabel>
                  <Select
                    label="Scenario Preset"
                    value={inputs.preset}
                    onChange={(e) => applyPreset(e.target.value as any)}
                  >
                    <MenuItem value="custom">Custom</MenuItem>
                    <MenuItem value="conservative">Conservative</MenuItem>
                    <MenuItem value="base">Base</MenuItem>
                    <MenuItem value="aggressive">Aggressive</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Compounding</InputLabel>
                  <Select
                    label="Compounding"
                    value={inputs.compounding}
                    onChange={(e) => setInputs((p) => ({ ...p, compounding: e.target.value as any }))}
                  >
                    <MenuItem value="annual">Annually</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Contribution Frequency</InputLabel>
                  <Select
                    label="Contribution Frequency"
                    value={inputs.contributionFrequency}
                    onChange={(e) => setInputs((p) => ({ ...p, contributionFrequency: e.target.value as any }))}
                  >
                    <MenuItem value="annual">Annually</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>

                {inputs.contributionFrequency === 'annual' ? (
                  <TextField
                    label="Annual Investment (EUR)"
                    type="number"
                    value={inputs.annualInvestment}
                    onChange={handleInputChange('annualInvestment')}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: 100 } }}
                  />
                ) : (
                  <TextField
                    label="Monthly Investment (EUR)"
                    type="number"
                    value={inputs.monthlyInvestment}
                    onChange={handleInputChange('monthlyInvestment')}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0, step: 10 } }}
                  />
                )}

                <TextField
                  label="Investment Period (Years)"
                  type="number"
                  value={inputs.maxYears}
                  onChange={handleInputChange('maxYears')}
                  fullWidth
                  slotProps={{ htmlInput: { min: 1, max: 50 } }}
                />

                <TextField
                  label="Expected Inflation (%)"
                  type="number"
                  value={inputs.expectedInflation}
                  onChange={handleInputChange('expectedInflation')}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, max: 20, step: 0.1 } }}
                />

                <TextField
                  label="Annual Fee / Expense Ratio (%)"
                  type="number"
                  value={inputs.annualFee}
                  onChange={handleInputChange('annualFee')}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, max: 5, step: 0.05 } }}
                />

                <TextField
                  label="Target Goal (EUR)"
                  type="number"
                  value={inputs.targetGoal}
                  onChange={handleInputChange('targetGoal')}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: 500 } }}
                  helperText="Optional: used to show time to goal and goal line on the chart"
                />

                {/* Monte Carlo controls */}
                <FormControl fullWidth>
                  <InputLabel>Monte Carlo</InputLabel>
                  <Select
                    label="Monte Carlo"
                    value={inputs.enableMonteCarlo ? 'on' : 'off'}
                    onChange={(e) => setInputs((p) => ({ ...p, enableMonteCarlo: (e.target.value as string) === 'on' }))}
                  >
                    <MenuItem value="off">Off</MenuItem>
                    <MenuItem value="on">On</MenuItem>
                  </Select>
                </FormControl>

                {inputs.enableMonteCarlo && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      label="Annual Volatility (%)"
                      type="number"
                      value={inputs.annualVolatility}
                      onChange={handleInputChange('annualVolatility')}
                      fullWidth
                      slotProps={{ htmlInput: { min: 1, max: 80, step: 0.5 } }}
                    />
                    <TextField
                      label="# Simulations"
                      type="number"
                      value={inputs.numSimulations}
                      onChange={handleInputChange('numSimulations')}
                      fullWidth
                      slotProps={{ htmlInput: { min: 100, max: 5000, step: 100 } }}
                    />
                    <FormControl fullWidth>
                      <InputLabel>Return Distribution</InputLabel>
                      <Select
                        label="Return Distribution"
                        value={inputs.distribution}
                        onChange={(e) => setInputs((p) => ({ ...p, distribution: e.target.value as any }))}
                      >
                        <MenuItem value="normal">Normal (Gaussian)</MenuItem>
                        <MenuItem value="studentT">Student's t (fat tails)</MenuItem>
                        <MenuItem value="mixture">Mixture (tail shocks)</MenuItem>
                      </Select>
                    </FormControl>
                    {inputs.distribution === 'studentT' && (
                      <TextField
                        label="Student t degrees of freedom"
                        type="number"
                        value={inputs.studentTDegrees}
                        onChange={handleInputChange('studentTDegrees')}
                        fullWidth
                        slotProps={{ htmlInput: { min: 2, max: 50, step: 1 } }}
                      />
                    )}
                    {inputs.distribution === 'mixture' && (
                      <TextField
                        label="Tail shock probability"
                        type="number"
                        value={inputs.mixtureKurtosis}
                        onChange={handleInputChange('mixtureKurtosis')}
                        fullWidth
                        slotProps={{ htmlInput: { min: 0, max: 0.9, step: 0.05 } }}
                        helperText="Probability of a large ±(2.5–4)σ shock per step"
                      />
                    )}
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={calculateGrowth}
                    startIcon={<Calculate />}
                    fullWidth
                  >
                    Calculate
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    fullWidth
                  >
                    Reset
                  </Button>
                </Box>
              </Box>

              {/* Summary Results */}
              {isCalculated && finalResult && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Final Results (Year {inputs.maxYears})
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total Invested:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(finalResult.moneyInvested)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Market Gains:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        {formatCurrency(finalResult.gainFromMarket)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Portfolio Value:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {formatCurrency(finalResult.portfolioTotalValue)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Inflation Adjusted:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                        {formatCurrency(finalResult.inflationAdjustedValue)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid #ccc' }}>
                      <Typography variant="body2">Return on Investment:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        {formatPercentage((finalResult.gainFromMarket / finalResult.moneyInvested) * 100)}
                      </Typography>
                    </Box>
                    {goal !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Years to Goal:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: yearsToGoal ? 'primary.main' : 'text.secondary' }}>
                          {yearsToGoal ? `${yearsToGoal} years` : 'Not reached'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Chart */}
        <Box sx={{ flex: 1 }}>
          {isCalculated && results.length > 0 && (
            <StockGrowthChart data={results} goal={goal} mcBands={mcBands || undefined} />
          )}
        </Box>
      </Box>

        {/* Results Table */}
        {isCalculated && results.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', m: 0 }}>
                  <TableChart sx={{ mr: 1 }} />
                  Detailed Yearly Breakdown
                  </Typography>
                  <Button variant="outlined" size="small" onClick={downloadCSV}>Download CSV</Button>
                </Box>

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
                      {results.map((row) => (
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
                          <TableCell 
                            align="right" 
                            sx={{ color: 'primary.main', fontWeight: 'medium' }}
                          >
                            {formatCurrency(row.portfolioTotalValue)}
                          </TableCell>
                          <TableCell 
                            align="right" 
                            sx={{ color: 'warning.main', fontWeight: 'medium' }}
                          >
                            {formatCurrency(row.inflationAdjustedValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Note:</strong> This calculator assumes a constant annual return and inflation rate. 
                    Real market performance will vary significantly year to year. Results are for educational purposes only 
                    and should not be considered as investment advice.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Box>
        )}
    </Box>
  );
};

export default StockGrowthCalculator;
