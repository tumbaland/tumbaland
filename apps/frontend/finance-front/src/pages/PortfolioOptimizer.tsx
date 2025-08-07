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
import OptimizationResults from '../components/OptimizationResults';
import PortfolioAllocationDonut from '../components/PortfolioAllocationDonut';


interface OptimizationInputs {
  selectedTickers: string[];
  investmentAmount: number;
  riskTolerance: number;
  expectedReturn: number;
  optimizationType: 'max_sharpe' | 'min_risk' | 'target_return';
  riskFreeRate: number;
  lookbackPeriod: number;
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
    lookbackPeriod: 252 // 1 year of trading days
  });

  const [assetStats, setAssetStats] = useState<AssetStats[]>([]);
  const [optimalPortfolio, setOptimalPortfolio] = useState<OptimalPortfolio | null>(null);
  const [efficientFrontier, setEfficientFrontier] = useState<Array<{return: number, risk: number}>>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>([]);

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

  const optimizePortfolio = () => {
    if (assetStats.length < 2) {
      setError('Need at least 2 assets for optimization');
      return;
    }

    // Simplified optimization - in a real implementation, you'd use quadratic programming
    let optimalWeights: Record<string, number> = {};
    
    if (inputs.optimizationType === 'max_sharpe') {
      // Maximum Sharpe ratio: favor assets with highest Sharpe ratios
      const totalSharpe = assetStats.reduce((sum, asset) => sum + Math.max(asset.sharpeRatio, 0), 0);
      
      assetStats.forEach(asset => {
        const weight = Math.max(asset.sharpeRatio, 0) / totalSharpe;
        optimalWeights[asset.ticker] = weight;
      });
    } else if (inputs.optimizationType === 'min_risk') {
      // Minimum variance: equal weighting for simplicity (proper implementation would use covariance matrix)
      const equalWeight = 1 / assetStats.length;
      assetStats.forEach(asset => {
        optimalWeights[asset.ticker] = equalWeight;
      });
    } else if (inputs.optimizationType === 'target_return') {
      // Target return optimization: weight by expected returns relative to target
      const totalReturn = assetStats.reduce((sum, asset) => sum + asset.expectedReturn / 100, 0);
      
      assetStats.forEach(asset => {
        const weight = (asset.expectedReturn / 100) / totalReturn;
        optimalWeights[asset.ticker] = weight;
      });
    }

    // Calculate portfolio metrics
    const portfolioReturn = assetStats.reduce((sum, asset) => 
      sum + optimalWeights[asset.ticker] * (asset.expectedReturn / 100), 0
    );
    
    // Simplified portfolio volatility calculation (assumes perfect correlation)
    const portfolioVolatility = assetStats.reduce((sum, asset) => 
      sum + optimalWeights[asset.ticker] * (asset.volatility / 100), 0
    );
    
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
    
    const points: Array<{return: number, risk: number}> = [];
    
    // Get the range of returns for the efficient frontier
    const minAssetReturn = Math.min(...assetStats.map(a => a.expectedReturn / 100));
    const maxAssetReturn = Math.max(...assetStats.map(a => a.expectedReturn / 100));
    
    // For efficient frontier, we want to start from minimum variance portfolio
    // and go up to higher returns, showing the minimum risk for each return level
    const minReturn = minAssetReturn * 0.8; // Start below lowest asset return
    const maxReturn = maxAssetReturn * 1.2; // Go beyond highest asset return
    
    const numPoints = 100; // More points for smoother curve
    
    for (let i = 0; i < numPoints; i++) {
      const targetReturn = minReturn + (i / (numPoints - 1)) * (maxReturn - minReturn);
      let minRisk = Infinity;
      
      if (assetStats.length === 2) {
        // For 2 assets, calculate exact efficient frontier
        const [asset1, asset2] = assetStats;
        const r1 = asset1.expectedReturn / 100;
        const r2 = asset2.expectedReturn / 100;
        const σ1 = asset1.volatility / 100;
        const σ2 = asset2.volatility / 100;
        
        if (Math.abs(r1 - r2) > 0.001) {
          const w1 = (targetReturn - r2) / (r1 - r2);
          const w2 = 1 - w1;
          
          // Use actual correlation
          const correlation = correlationMatrix.length >= 2 ? correlationMatrix[0][1] : 0.3;
          
          // Calculate portfolio variance
          const portfolioVariance = 
            w1 * w1 * σ1 * σ1 + 
            w2 * w2 * σ2 * σ2 + 
            2 * w1 * w2 * correlation * σ1 * σ2;
          
          if (portfolioVariance >= 0) {
            minRisk = Math.sqrt(portfolioVariance);
          }
        }
      } else {
        // For multiple assets, use optimization to find minimum risk
        // Try many different weight combinations systematically
        const numCombinations = 5000; // More combinations for better accuracy
        
        for (let combo = 0; combo < numCombinations; combo++) {
          // Generate diversified portfolio weights using Dirichlet distribution simulation
          const rawWeights: number[] = [];
          for (let j = 0; j < assetStats.length; j++) {
            rawWeights.push(-Math.log(Math.random())); // Exponential random variables
          }
          
          // Normalize to sum to 1
          const weightSum = rawWeights.reduce((sum, w) => sum + w, 0);
          const weights = rawWeights.map(w => w / weightSum);
          
          // Calculate portfolio return
          const portfolioReturn = assetStats.reduce((sum, asset, idx) => 
            sum + weights[idx] * (asset.expectedReturn / 100), 0
          );
          
          // Check if this achieves target return (with tight tolerance)
          if (Math.abs(portfolioReturn - targetReturn) < 0.005) { // 0.5% tolerance
            
            // Calculate portfolio risk using covariance matrix
            let portfolioVariance = 0;
            
            // Add diagonal terms (individual variances)
            assetStats.forEach((asset, idx) => {
              const variance = Math.pow(asset.volatility / 100, 2);
              portfolioVariance += weights[idx] * weights[idx] * variance;
            });
            
            // Add off-diagonal terms (covariances)
            for (let idx1 = 0; idx1 < assetStats.length; idx1++) {
              for (let idx2 = idx1 + 1; idx2 < assetStats.length; idx2++) {
                const σ1 = assetStats[idx1].volatility / 100;
                const σ2 = assetStats[idx2].volatility / 100;
                
                // Use correlation matrix if available
                let correlation = 0.2; // Conservative default
                if (correlationMatrix.length > idx1 && correlationMatrix[idx1].length > idx2) {
                  correlation = correlationMatrix[idx1][idx2];
                }
                
                portfolioVariance += 2 * weights[idx1] * weights[idx2] * correlation * σ1 * σ2;
              }
            }
            
            const portfolioRisk = Math.sqrt(Math.max(0, portfolioVariance));
            minRisk = Math.min(minRisk, portfolioRisk);
          }
        }
      }
      
      // Only include valid points that represent actual efficient portfolios
      if (minRisk < Infinity && minRisk > 0) {
        points.push({
          return: targetReturn * 100,
          risk: minRisk * 100
        });
      }
    }
    
    // Filter and sort points
    let validPoints = points
      .filter(p => p.risk > 0 && p.return > 0 && !isNaN(p.risk) && !isNaN(p.return))
      .sort((a, b) => a.risk - b.risk);
    
    // Remove points that are clearly inefficient (higher risk for same/lower return)
    const efficientPoints: Array<{return: number, risk: number}> = [];
    let maxReturnSoFar = -Infinity;
    
    for (const point of validPoints) {
      if (point.return > maxReturnSoFar) {
        efficientPoints.push(point);
        maxReturnSoFar = point.return;
      }
    }
    
    // Ensure the optimal portfolio point is on the frontier
    if (optimalPortfolio) {
      const optimalPoint = {
        return: optimalPortfolio.expectedReturn,
        risk: optimalPortfolio.volatility
      };
      
      // Check if optimal point is close to any existing point
      const existingPointClose = efficientPoints.some(p => 
        Math.abs(p.return - optimalPoint.return) < 1.0 && 
        Math.abs(p.risk - optimalPoint.risk) < 1.0
      );
      
      if (!existingPointClose) {
        efficientPoints.push(optimalPoint);
        efficientPoints.sort((a, b) => a.risk - b.risk);
      }
    }
    
    // Ensure we have a reasonable number of points
    if (efficientPoints.length < 5) {
      console.warn('Not enough points for efficient frontier');
      return;
    }
    
    setEfficientFrontier(efficientPoints);
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
    if (assetStats.length > 0) {
      optimizePortfolio();
    }
  }, [assetStats, inputs.optimizationType, inputs.expectedReturn, inputs.riskFreeRate]);

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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <OptimizationResults
                    portfolio={optimalPortfolio}
                    assetStats={assetStats}
                    investmentAmount={inputs.investmentAmount}
                  />
                  <PortfolioAllocationDonut
                    allocation={optimalPortfolio.allocation}
                    totalAmount={inputs.investmentAmount}
                  />
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <EfficientFrontierChart
                  frontierData={efficientFrontier}
                  optimalPortfolio={optimalPortfolio}
                  assetStats={assetStats}
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
