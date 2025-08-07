import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
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
    expectedInflation: 2.5
  });

  const [results, setResults] = useState<YearlyResult[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);

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

    for (let year = 1; year <= inputs.maxYears; year++) {
      // Add annual investment at the beginning of the year
      if (year > 1) {
        totalInvested += inputs.annualInvestment;
        portfolioValue += inputs.annualInvestment;
      }

      // Apply market growth
      portfolioValue *= (1 + inputs.expectedGrowth / 100);

      // Calculate gains
      const gainFromMarket = portfolioValue - totalInvested;

      // Calculate inflation-adjusted value
      const inflationAdjustedValue = portfolioValue / Math.pow(1 + inputs.expectedInflation / 100, year);

      yearlyResults.push({
        year,
        moneyInvested: totalInvested,
        gainFromMarket,
        portfolioTotalValue: portfolioValue,
        inflationAdjustedValue
      });
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
      expectedInflation: 2.5
    });
    setResults([]);
    setIsCalculated(false);
  };

  // Auto-calculate when inputs change
  useEffect(() => {
    if (inputs.startingCapital > 0 && inputs.maxYears > 0) {
      calculateGrowth();
    }
  }, [inputs]);

  const finalResult = results[results.length - 1];

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
                  inputProps={{ min: 0, step: 100 }}
                />

                <TextField
                  label="Expected Annual Growth (%)"
                  type="number"
                  value={inputs.expectedGrowth}
                  onChange={handleInputChange('expectedGrowth')}
                  fullWidth
                  inputProps={{ min: 0, max: 50, step: 0.1 }}
                />

                <TextField
                  label="Annual Investment (EUR)"
                  type="number"
                  value={inputs.annualInvestment}
                  onChange={handleInputChange('annualInvestment')}
                  fullWidth
                  inputProps={{ min: 0, step: 100 }}
                />

                <TextField
                  label="Investment Period (Years)"
                  type="number"
                  value={inputs.maxYears}
                  onChange={handleInputChange('maxYears')}
                  fullWidth
                  inputProps={{ min: 1, max: 50 }}
                />

                <TextField
                  label="Expected Inflation (%)"
                  type="number"
                  value={inputs.expectedInflation}
                  onChange={handleInputChange('expectedInflation')}
                  fullWidth
                  inputProps={{ min: 0, max: 20, step: 0.1 }}
                />

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
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Chart */}
        <Box sx={{ flex: 1 }}>
          {isCalculated && results.length > 0 && (
            <StockGrowthChart data={results} />
          )}
        </Box>
      </Box>

        {/* Results Table */}
        {isCalculated && results.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <TableChart sx={{ mr: 1 }} />
                  Detailed Yearly Breakdown
                </Typography>

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
