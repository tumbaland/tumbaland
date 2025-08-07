import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import { Assessment, TrendingUp, PieChart } from '@mui/icons-material';

interface OptimalPortfolio {
  weights: Record<string, number>;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  allocation: Record<string, number>;
}

interface AssetStats {
  ticker: string;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
}

interface OptimizationResultsProps {
  portfolio: OptimalPortfolio;
  assetStats: AssetStats[];
  investmentAmount: number;
}

const OptimizationResults: React.FC<OptimizationResultsProps> = ({
  portfolio,
  assetStats,
  investmentAmount
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // Combine portfolio weights with asset stats
  const portfolioBreakdown = Object.entries(portfolio.weights)
    .map(([ticker, weight]) => {
      const assetStat = assetStats.find(stat => stat.ticker === ticker);
      return {
        ticker,
        weight,
        allocation: portfolio.allocation[ticker] || 0,
        expectedReturn: assetStat?.expectedReturn || 0,
        volatility: assetStat?.volatility || 0,
        sharpeRatio: assetStat?.sharpeRatio || 0
      };
    })
    .filter(item => item.weight > 0.001) // Filter out very small allocations
    .sort((a, b) => b.weight - a.weight);

  const getRiskLevel = (volatility: number) => {
    if (volatility < 15) return { label: 'Low', color: 'success' };
    if (volatility < 25) return { label: 'Medium', color: 'warning' };
    return { label: 'High', color: 'error' };
  };

  const getReturnLevel = (expectedReturn: number) => {
    if (expectedReturn < 8) return { label: 'Conservative', color: 'info' };
    if (expectedReturn < 15) return { label: 'Moderate', color: 'primary' };
    return { label: 'Aggressive', color: 'secondary' };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Portfolio Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Card sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingUp sx={{ mr: 1 }} />
              <Typography variant="h6">Expected Return</Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {portfolio.expectedReturn.toFixed(2)}%
            </Typography>
            <Chip
              label={getReturnLevel(portfolio.expectedReturn).label}
              size="small"
              sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </CardContent>
        </Card>

        <Card sx={{ background: 'linear-gradient(135deg, #ed6c02 0%, #ff9800 100%)', color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Assessment sx={{ mr: 1 }} />
              <Typography variant="h6">Risk (Volatility)</Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {portfolio.volatility.toFixed(2)}%
            </Typography>
            <Chip
              label={getRiskLevel(portfolio.volatility).label}
              size="small"
              sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </CardContent>
        </Card>

        <Card sx={{ background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', color: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <PieChart sx={{ mr: 1 }} />
              <Typography variant="h6">Sharpe Ratio</Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {portfolio.sharpeRatio.toFixed(3)}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Risk-adjusted return
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Portfolio Breakdown Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Assessment sx={{ mr: 1 }} />
            Portfolio Breakdown
          </Typography>

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Asset</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Weight</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Allocation</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Expected Return</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Volatility</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Sharpe Ratio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolioBreakdown.map((asset) => (
                  <TableRow key={asset.ticker} hover>
                    <TableCell sx={{ fontWeight: 'medium' }}>{asset.ticker}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {formatPercentage(asset.weight)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {formatCurrency(asset.allocation)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          color: asset.expectedReturn > 10 ? 'success.main' : 'text.primary',
                          fontWeight: 'medium'
                        }}
                      >
                        {asset.expectedReturn.toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${asset.volatility.toFixed(1)}%`}
                        size="small"
                        color={getRiskLevel(asset.volatility).color as any}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          color: asset.sharpeRatio > 0.5 ? 'success.main' : asset.sharpeRatio > 0 ? 'warning.main' : 'error.main',
                          fontWeight: 'medium'
                        }}
                      >
                        {asset.sharpeRatio.toFixed(3)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Portfolio Total Row */}
                <TableRow sx={{ bgcolor: 'grey.50', borderTop: '2px solid #e0e0e0' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Portfolio Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatPercentage(Object.values(portfolio.weights).reduce((sum, w) => sum + w, 0))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(investmentAmount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {portfolio.expectedReturn.toFixed(2)}%
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                    {portfolio.volatility.toFixed(2)}%
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {portfolio.sharpeRatio.toFixed(3)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Key Insights */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'info.50', borderRadius: 2, border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'info.main', mb: 2 }}>
              Key Insights:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {portfolioBreakdown.length > 0 && (
                <Typography variant="body2">
                  • <strong>Largest holding:</strong> {portfolioBreakdown[0].ticker} at {formatPercentage(portfolioBreakdown[0].weight)}
                </Typography>
              )}
              <Typography variant="body2">
                • <strong>Diversification:</strong> Portfolio spread across {portfolioBreakdown.length} assets
              </Typography>
              <Typography variant="body2">
                • <strong>Risk profile:</strong> {getRiskLevel(portfolio.volatility).label} risk with {portfolio.volatility.toFixed(1)}% volatility
              </Typography>
              {portfolio.sharpeRatio > 1 && (
                <Typography variant="body2" color="success.main">
                  • <strong>Excellent risk-adjusted returns:</strong> Sharpe ratio of {portfolio.sharpeRatio.toFixed(3)} indicates strong performance per unit of risk
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OptimizationResults;
