import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Slider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import { Tune, TrendingUp, PieChart, Timeline, Refresh } from '@mui/icons-material';
import { getTrackedTickers, TrackedTicker } from '../services/trackedTickerService';
import { getTickerPriceHistory, TickerPriceHistory } from '../services/tickerPriceHistoryService';
import EfficientFrontierChart from '../components/EfficientFrontierChart';
import OptimalPortfolioChart from '../components/OptimalPortfolioChart';
import AllocationView from '../components/AllocationView';
import {
  buildMuSigma,
  weightsTangency,
  weightsMinVariance,
  weightsTargetReturn,
  portfolioReturn as pfReturn,
  portfolioVariance as pfVariance,
  computeEfficientFrontierUnconstrained,
  computeEfficientFrontierNoShort,
  projectToSimplex,
  
} from '../utils/portfolioMath';


interface OptimizationInputs {
  selectedTickers: string[];
  investmentAmount: number;
  riskTolerance: number;
  expectedReturn: number;
  optimizationType: 'max_sharpe' | 'min_risk' | 'target_return';
  riskFreeRate: number;
  lookbackPeriod: number;
  allowShorts?: boolean;
}

interface AssetStats {
  ticker: string;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
}

interface OptimalPortfolio {
  weights: Record<string, number>;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  allocation: Record<string, number>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`optimization-tabpanel-${index}`}
      aria-labelledby={`optimization-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const PortfolioOptimizer: React.FC = () => {
  const [availableTickers, setAvailableTickers] = useState<TrackedTicker[]>([]);
  const [, setPriceData] = useState<Record<string, TickerPriceHistory[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  const [inputs, setInputs] = useState<OptimizationInputs>({
    selectedTickers: [],
    investmentAmount: 10000,
    riskTolerance: 5,
    expectedReturn: 10,
    optimizationType: 'max_sharpe',
    riskFreeRate: 2.0,
  lookbackPeriod: 252, // 1 year of trading days
  allowShorts: false
  });

  const [assetStats, setAssetStats] = useState<AssetStats[]>([]);
  const [optimalPortfolio, setOptimalPortfolio] = useState<OptimalPortfolio | null>(null);
  const [efficientFrontier, setEfficientFrontier] = useState<Array<{return: number, risk: number}>>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>([]);
  const [dailyReturnsByTicker, setDailyReturnsByTicker] = useState<Record<string, number[]>>({});

  useEffect(() => {
    fetchAvailableTickers();
  }, []);

  const fetchAvailableTickers = async () => {
    try {
      const tickers = await getTrackedTickers();
      setAvailableTickers(tickers.filter(t => t.isActive));
    } catch (err) {
      setError('Failed to fetch available tickers');
    }
  };

  const fetchPriceData = async (tickers: string[]) => {
    setLoading(true);
    try {
      const pricePromises = tickers.map(async (ticker) => {
        const data = await getTickerPriceHistory(ticker);
        return { ticker, data: data.filter(d => d.ticker === ticker) };
      });
      
      const results = await Promise.all(pricePromises);
      const priceMap: Record<string, TickerPriceHistory[]> = {};
      
      results.forEach(({ ticker, data }) => {
        // Sort by date and take only the lookback period
        const sortedData = data
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(-inputs.lookbackPeriod);
        priceMap[ticker] = sortedData;
      });
      
      setPriceData(priceMap);
      calculateAssetStatistics(priceMap);
    } catch (err) {
      setError('Failed to fetch price data');
    } finally {
      setLoading(false);
    }
  };

  const calculateReturns = (prices: number[]): number[] => {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(dailyReturn);
    }
    return returns;
  };

  const calculateAssetStatistics = (priceMap: Record<string, TickerPriceHistory[]>) => {
    const stats: AssetStats[] = [];
    const allReturns: Record<string, number[]> = {};

    Object.entries(priceMap).forEach(([ticker, prices]) => {
      if (prices.length < 10) return; // Need sufficient data

      const closePrices = prices.map(p => p.close);
      const returns = calculateReturns(closePrices);
      allReturns[ticker] = returns;

      // Calculate annualized statistics
      const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
      
      // Annualize (assuming 252 trading days per year)
      const annualizedReturn = meanReturn * 252;
      const annualizedVolatility = Math.sqrt(variance * 252);
      const sharpeRatio = (annualizedReturn - inputs.riskFreeRate / 100) / annualizedVolatility;

      stats.push({
        ticker,
        expectedReturn: annualizedReturn * 100, // Convert to percentage
        volatility: annualizedVolatility * 100,
        sharpeRatio
      });
    });

    setAssetStats(stats);
    calculateCorrelationMatrix(allReturns);
  setDailyReturnsByTicker(allReturns);
  };

  const calculateCorrelationMatrix = (allReturns: Record<string, number[]>) => {
    const tickers = Object.keys(allReturns);
    const n = tickers.length;
    const correlations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          correlations[i][j] = 1;
        } else {
          const returnsI = allReturns[tickers[i]];
          const returnsJ = allReturns[tickers[j]];
          const correlation = calculateCorrelation(returnsI, returnsJ);
          correlations[i][j] = correlation;
        }
      }
    }

    setCorrelationMatrix(correlations);
  };

  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Basic linear algebra helpers for optimization
  // math helpers replaced by utils

  const optimizePortfolio = () => {
    if (assetStats.length < 2) {
      setError('Need at least 2 assets for optimization');
      return;
    }

    const tickersAll = assetStats.map(a => a.ticker);
    const { mu: muAll, Sigma: SigmaAll } = buildMuSigma(dailyReturnsByTicker, tickersAll);

    // If shorting is disabled and we're maximizing Sharpe, pick the best Sharpe point from the constrained frontier
    if (inputs.allowShorts === false && inputs.optimizationType === 'max_sharpe') {
      const ef = computeEfficientFrontierNoShort(muAll, SigmaAll, 80, 320, 0.03);
      if (ef.length > 0) {
        const rf = inputs.riskFreeRate;
        let best = ef[0];
        let bestSharpe = ((best.return - rf) / Math.max(1e-9, best.risk));
        for (const p of ef) {
          const s = (p.return - rf) / Math.max(1e-9, p.risk);
          if (s > bestSharpe) { bestSharpe = s; best = p; }
        }
        const w = best.weights || [];
        const optimalWeights: Record<string, number> = {};
        tickersAll.forEach((t, i) => (optimalWeights[t] = w[i] ?? 0));

        // Build portfolio metrics from chosen point (best.return/risk are in percent)
        const ret = best.return; // percent
        const risk = best.risk; // percent
        const sharpe = ((ret - rf) / Math.max(1e-9, risk));

        // Calculate dollar allocations
        const allocation: Record<string, number> = {};
        Object.entries(optimalWeights).forEach(([ticker, weight]) => {
          allocation[ticker] = weight * inputs.investmentAmount;
        });

        setOptimalPortfolio({
          weights: optimalWeights,
          expectedReturn: ret,
          volatility: risk,
          sharpeRatio: sharpe,
          allocation
        });
        setEfficientFrontier(ef.map(p => ({ return: p.return, risk: p.risk })));
        return; // Done
      }
    }

    // We'll compute weights based on selected optimization type
    let optimalWeights: Record<string, number> = {};

    if (inputs.optimizationType === 'max_sharpe') {
      // Use math utils for tangency
      const tickers = assetStats.map(a => a.ticker);
      const { mu, Sigma } = buildMuSigma(dailyReturnsByTicker, tickers);
      let w = weightsTangency(mu, Sigma, inputs.riskFreeRate / 100);
      if (w && inputs.allowShorts === false) {
        w = projectToSimplex(w);
      }
      if (w) tickers.forEach((t, i) => (optimalWeights[t] = w![i]));
      else {
        // Fallback: weight by positive Sharpe
        const totalSharpe = assetStats.reduce((sum, a) => sum + Math.max(a.sharpeRatio, 0), 0) || 1;
        assetStats.forEach(a => (optimalWeights[a.ticker] = Math.max(a.sharpeRatio, 0) / totalSharpe));
      }
    } else if (inputs.optimizationType === 'min_risk') {
      // Minimum variance weights from Σ^-1 1 normalized
      const tickers = assetStats.map(a => a.ticker);
      const { Sigma } = buildMuSigma(dailyReturnsByTicker, tickers);
      let w = weightsMinVariance(Sigma);
      if (w && inputs.allowShorts === false) {
        w = projectToSimplex(w);
      }
      if (w) tickers.forEach((t, i) => (optimalWeights[t] = w![i]));
      else {
        const eq = 1 / assetStats.length;
        assetStats.forEach(a => (optimalWeights[a.ticker] = eq));
      }
    } else if (inputs.optimizationType === 'target_return') {
      // Analytic target-return solution on the frontier
      const tickers = assetStats.map(a => a.ticker);
      const { mu, Sigma } = buildMuSigma(dailyReturnsByTicker, tickers);
      const target = inputs.expectedReturn / 100;
      let w = weightsTargetReturn(mu, Sigma, target);
      if (w && inputs.allowShorts === false) {
        w = projectToSimplex(w);
      }
      if (w) tickers.forEach((t, i) => (optimalWeights[t] = w![i]));
      else {
        // fallback to proportional to expected return
        const total = assetStats.reduce((s, a) => s + a.expectedReturn / 100, 0) || 1;
        assetStats.forEach(a => (optimalWeights[a.ticker] = (a.expectedReturn / 100) / total));
      }
    }

    // Calculate portfolio metrics
    // Use covariance matrix for proper portfolio volatility
  const tickers = tickersAll;
  const mu = muAll;
  const Sigma = SigmaAll;
  const weightsVec = tickers.map(t => optimalWeights[t] ?? 0);
  const portfolioReturn = pfReturn(weightsVec, mu);
  const variance = Math.max(0, pfVariance(weightsVec, Sigma));
  const portfolioVolatility = Math.sqrt(variance);
    
    const portfolioSharpe = (portfolioReturn - inputs.riskFreeRate / 100) / portfolioVolatility;

    // Calculate dollar allocations
    const allocation: Record<string, number> = {};
    Object.entries(optimalWeights).forEach(([ticker, weight]) => {
      allocation[ticker] = weight * inputs.investmentAmount;
    });

    setOptimalPortfolio({
      weights: optimalWeights,
      expectedReturn: portfolioReturn * 100,
      volatility: portfolioVolatility * 100,
      sharpeRatio: portfolioSharpe,
      allocation
    });

  generateEfficientFrontier();
  };

  const generateEfficientFrontier = () => {
    if (assetStats.length < 2) return;
  // Use analytic method; no need for random sampling points here
  // Analytic efficient frontier when shorting allowed; otherwise constrained approximation
  const tickers = assetStats.map(a => a.ticker);
  const { mu, Sigma } = buildMuSigma(dailyReturnsByTicker, tickers);
  const ef = inputs.allowShorts
    ? computeEfficientFrontierUnconstrained(mu, Sigma, 100)
    : computeEfficientFrontierNoShort(mu, Sigma, 80, 300, 0.03);
  if (ef.length >= 2) setEfficientFrontier(ef.map(p => ({ return: p.return, risk: p.risk })));
  };

  const handleTickerSelect = (ticker: string) => {
    setInputs(prev => ({
      ...prev,
      selectedTickers: prev.selectedTickers.includes(ticker)
        ? prev.selectedTickers.filter(t => t !== ticker)
        : [...prev.selectedTickers, ticker]
    }));
  };

  const handleOptimize = () => {
    if (inputs.selectedTickers.length < 2) {
      setError('Please select at least 2 tickers for optimization');
      return;
    }
    
    setError(null);
    fetchPriceData(inputs.selectedTickers);
  };

  useEffect(() => {
    if (assetStats.length > 0 && Object.keys(dailyReturnsByTicker).length > 0) {
      optimizePortfolio();
    }
  }, [assetStats, dailyReturnsByTicker, inputs.optimizationType, inputs.expectedReturn, inputs.riskFreeRate, inputs.allowShorts]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
        Portfolio Optimizer
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Configuration Panel */}
        <Box sx={{ flex: { xs: 1, lg: '0 0 400px' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Tune sx={{ mr: 1 }} />
                Optimization Settings
              </Typography>

              {/* Ticker Selection */}
              <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>
                Select Assets ({inputs.selectedTickers.length} selected)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {availableTickers.map(ticker => (
                  <Chip
                    key={ticker.ticker}
                    label={`${ticker.ticker} - ${ticker.displayName}`}
                    onClick={() => handleTickerSelect(ticker.ticker)}
                    color={inputs.selectedTickers.includes(ticker.ticker) ? 'primary' : 'default'}
                    variant={inputs.selectedTickers.includes(ticker.ticker) ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Box>

              {/* Investment Amount */}
              <TextField
                label="Investment Amount (EUR)"
                type="number"
                value={inputs.investmentAmount}
                onChange={(e) => setInputs(prev => ({ ...prev, investmentAmount: Number(e.target.value) }))}
                fullWidth
                sx={{ mb: 3 }}
                inputProps={{ min: 1000, step: 1000 }}
              />

              {/* Optimization Type */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Optimization Strategy</InputLabel>
                <Select
                  value={inputs.optimizationType}
                  label="Optimization Strategy"
                  onChange={(e) => setInputs(prev => ({ ...prev, optimizationType: e.target.value as any }))}
                >
                  <MenuItem value="max_sharpe">Maximize Sharpe Ratio</MenuItem>
                  <MenuItem value="min_risk">Minimize Risk</MenuItem>
                  <MenuItem value="target_return">Target Return</MenuItem>
                </Select>
              </FormControl>

              {/* Allow Shorts */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel shrink>Advanced</InputLabel>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Chip
                    label={inputs.allowShorts ? 'Shorting: On' : 'Shorting: Off'}
                    color={inputs.allowShorts ? 'warning' : 'default'}
                    onClick={() => setInputs(prev => ({ ...prev, allowShorts: !prev.allowShorts }))}
                    size="small"
                  />
                </Box>
              </FormControl>

              {/* Risk-Free Rate */}
              <Typography variant="subtitle2" gutterBottom>
                Risk-Free Rate: {inputs.riskFreeRate.toFixed(1)}%
              </Typography>
              <Slider
                value={inputs.riskFreeRate}
                onChange={(_, value) => setInputs(prev => ({ ...prev, riskFreeRate: value as number }))}
                min={0}
                max={10}
                step={0.1}
                sx={{ mb: 3 }}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 5, label: '5%' },
                  { value: 10, label: '10%' }
                ]}
              />

              {/* Target Return (only for target return optimization) */}
              {inputs.optimizationType === 'target_return' && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Target Return: {inputs.expectedReturn.toFixed(1)}%
                  </Typography>
                  <Slider
                    value={inputs.expectedReturn}
                    onChange={(_, value) => setInputs(prev => ({ ...prev, expectedReturn: value as number }))}
                    min={1}
                    max={30}
                    step={0.5}
                    sx={{ mb: 3 }}
                    marks={[
                      { value: 5, label: '5%' },
                      { value: 15, label: '15%' },
                      { value: 25, label: '25%' }
                    ]}
                  />
                </>
              )}

              {/* Lookback Period */}
              <TextField
                label="Lookback Period (Trading Days)"
                type="number"
                value={inputs.lookbackPeriod}
                onChange={(e) => setInputs(prev => ({ ...prev, lookbackPeriod: Number(e.target.value) }))}
                fullWidth
                sx={{ mb: 3 }}
                inputProps={{ min: 50, max: 1000, step: 50 }}
                helperText="252 days ≈ 1 year, 504 days ≈ 2 years"
              />

              {/* Optimize Button */}
              <Button
                variant="contained"
                onClick={handleOptimize}
                startIcon={loading ? <CircularProgress size={20} /> : <TrendingUp />}
                fullWidth
                disabled={loading || inputs.selectedTickers.length < 2}
                sx={{ mb: 2 }}
              >
                {loading ? 'Optimizing...' : 'Optimize Portfolio'}
              </Button>

              {optimalPortfolio && (
                <Button
                  variant="outlined"
                  onClick={() => setOptimalPortfolio(null)}
                  startIcon={<Refresh />}
                  fullWidth
                >
                  Clear Results
                </Button>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Results Panel */}
        <Box sx={{ flex: 1 }}>
          {optimalPortfolio && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                <Tab label="Allocation" icon={<PieChart />} />
                <Tab label="Efficient Frontier" icon={<Timeline />} />
                <Tab label="Analysis" icon={<TrendingUp />} />
              </Tabs>
            </Box>
          )}

          {optimalPortfolio && (
            <>
              <TabPanel value={tabValue} index={0}>
                <AllocationView
                  portfolio={{
                    expectedReturn: optimalPortfolio.expectedReturn,
                    volatility: optimalPortfolio.volatility,
                    sharpeRatio: optimalPortfolio.sharpeRatio,
                    weights: optimalPortfolio.weights
                  }}
                  allocation={optimalPortfolio.allocation}
                  assetStats={assetStats}
                  investmentAmount={inputs.investmentAmount}
                  selectedCount={inputs.selectedTickers.length}
                  allowShorts={inputs.allowShorts}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <EfficientFrontierChart
                  frontierData={efficientFrontier}
                  optimalPortfolio={optimalPortfolio}
                  assetStats={assetStats}
                  riskFreeRate={inputs.riskFreeRate}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <OptimalPortfolioChart
                  assetStats={assetStats}
                  correlationMatrix={correlationMatrix}
                  selectedTickers={inputs.selectedTickers}
                />
              </TabPanel>
            </>
          )}

          {!optimalPortfolio && !loading && (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Tune sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Portfolio Optimizer Ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select at least 2 assets and click "Optimize Portfolio" to see results
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PortfolioOptimizer;
