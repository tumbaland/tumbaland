import React from 'react';
import { Card, CardContent, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Analytics, TrendingUp } from '@mui/icons-material';

interface AssetStats {
  ticker: string;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
}

interface OptimalPortfolioChartProps {
  assetStats: AssetStats[];
  correlationMatrix: number[][];
  selectedTickers: string[];
}

const OptimalPortfolioChart: React.FC<OptimalPortfolioChartProps> = ({
  assetStats,
  correlationMatrix,
  selectedTickers
}) => {
  const [containerWidth, setContainerWidth] = React.useState(600);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 48);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (assetStats.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Analytics sx={{ mr: 1 }} />
            Portfolio Analysis
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No analysis data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const chartHeight = 300;
  const chartWidth = containerWidth;
  const padding = 80;

  // Calculate bounds for risk-return scatter plot
  const maxReturn = Math.max(...assetStats.map(a => a.expectedReturn));
  const minReturn = Math.min(...assetStats.map(a => a.expectedReturn));
  const maxRisk = Math.max(...assetStats.map(a => a.volatility));
  const minRisk = Math.min(...assetStats.map(a => a.volatility));

  const returnRange = maxReturn - minReturn || 1;
  const riskRange = maxRisk - minRisk || 1;

  const getXPosition = (risk: number) => {
    return padding + ((risk - minRisk) / riskRange) * (chartWidth - 2 * padding);
  };

  const getYPosition = (returnValue: number) => {
    return chartHeight - padding - ((returnValue - minReturn) / returnRange) * (chartHeight - 2 * padding);
  };

  const getCorrelationColor = (correlation: number) => {
    if (correlation > 0.7) return '#d32f2f'; // High positive correlation - red
    if (correlation > 0.3) return '#ff9800'; // Medium positive correlation - orange
    if (correlation > -0.3) return '#4caf50'; // Low correlation - green
    if (correlation > -0.7) return '#2196f3'; // Medium negative correlation - blue
    return '#9c27b0'; // High negative correlation - purple
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Asset Performance Scatter Plot */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <TrendingUp sx={{ mr: 1 }} />
            Risk vs Return Analysis
          </Typography>

          {/* Chart Container */}
          <Box ref={containerRef} sx={{ width: '100%', mb: 2 }}>
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ display: 'block' }}
            >
              {/* Grid lines */}
              <defs>
                <pattern id="analysisGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#analysisGrid)" />

              {/* Axes */}
              <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#666" strokeWidth="2" />
              <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="#666" strokeWidth="2" />

              {/* Y-axis labels (Return) */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const returnValue = minReturn + ratio * returnRange;
                const y = getYPosition(returnValue);
                return (
                  <g key={ratio}>
                    <line x1={padding - 5} y1={y} x2={padding + 5} y2={y} stroke="#666" strokeWidth="1" />
                    <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                      {returnValue.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* X-axis labels (Risk) */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const riskValue = minRisk + ratio * riskRange;
                const x = getXPosition(riskValue);
                return (
                  <g key={ratio}>
                    <line x1={x} y1={chartHeight - padding - 5} x2={x} y2={chartHeight - padding + 5} stroke="#666" strokeWidth="1" />
                    <text x={x} y={chartHeight - padding + 20} textAnchor="middle" fontSize="12" fill="#666">
                      {riskValue.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* Axis labels */}
              <text x={chartWidth / 2} y={chartHeight - 10} textAnchor="middle" fontSize="14" fill="#666" fontWeight="bold">
                Risk (Volatility %)
              </text>
              <text x={20} y={chartHeight / 2} textAnchor="middle" fontSize="14" fill="#666" fontWeight="bold" transform={`rotate(-90, 20, ${chartHeight / 2})`}>
                Expected Return (%)
              </text>

              {/* Assets as bubbles (size based on Sharpe ratio) */}
              {assetStats.map((asset) => {
                const x = getXPosition(asset.volatility);
                const y = getYPosition(asset.expectedReturn);
                const radius = Math.max(8, Math.min(20, 8 + asset.sharpeRatio * 8)); // Scale radius by Sharpe ratio
                const color = asset.sharpeRatio > 1 ? '#4caf50' : asset.sharpeRatio > 0.5 ? '#ff9800' : '#f44336';
                
                return (
                  <g key={asset.ticker}>
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={color}
                      fillOpacity={0.7}
                      stroke="white"
                      strokeWidth="2"
                    >
                      <title>
                        {`${asset.ticker}: ${asset.expectedReturn.toFixed(1)}% return, ${asset.volatility.toFixed(1)}% risk, Sharpe: ${asset.sharpeRatio.toFixed(2)}`}
                      </title>
                    </circle>
                    <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                      {asset.ticker}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Bubble size represents Sharpe ratio. Green = Excellent (&gt;1.0), Orange = Good (0.5-1.0), Red = Poor (&lt;0.5)
          </Typography>
        </CardContent>
      </Card>

      {/* Asset Statistics Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Analytics sx={{ mr: 1 }} />
            Asset Statistics
          </Typography>

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Asset</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Expected Return</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Volatility</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Sharpe Ratio</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Risk Rating</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Performance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assetStats
                  .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
                  .map((asset) => {
                    const riskRating = asset.volatility < 15 ? 'Low' : asset.volatility < 25 ? 'Medium' : 'High';
                    const performance = asset.sharpeRatio > 1 ? 'Excellent' : asset.sharpeRatio > 0.5 ? 'Good' : 'Poor';
                    
                    return (
                      <TableRow key={asset.ticker} hover>
                        <TableCell sx={{ fontWeight: 'medium' }}>{asset.ticker}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              color: asset.expectedReturn > 15 ? 'success.main' : asset.expectedReturn > 8 ? 'warning.main' : 'text.primary',
                              fontWeight: 'medium'
                            }}
                          >
                            {asset.expectedReturn.toFixed(2)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              color: asset.volatility > 25 ? 'error.main' : asset.volatility > 15 ? 'warning.main' : 'success.main',
                              fontWeight: 'medium'
                            }}
                          >
                            {asset.volatility.toFixed(2)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              color: asset.sharpeRatio > 1 ? 'success.main' : asset.sharpeRatio > 0.5 ? 'warning.main' : 'error.main',
                              fontWeight: 'bold'
                            }}
                          >
                            {asset.sharpeRatio.toFixed(3)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: riskRating === 'Low' ? 'success.100' : riskRating === 'Medium' ? 'warning.100' : 'error.100',
                              color: riskRating === 'Low' ? 'success.main' : riskRating === 'Medium' ? 'warning.main' : 'error.main',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}
                          >
                            {riskRating}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: performance === 'Excellent' ? 'success.100' : performance === 'Good' ? 'warning.100' : 'error.100',
                              color: performance === 'Excellent' ? 'success.main' : performance === 'Good' ? 'warning.main' : 'error.main',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}
                          >
                            {performance}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Correlation Matrix */}
      {correlationMatrix.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Analytics sx={{ mr: 1 }} />
              Asset Correlation Matrix
            </Typography>

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 400 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 80 }}>Asset</TableCell>
                    {selectedTickers.map(ticker => (
                      <TableCell key={ticker} align="center" sx={{ fontWeight: 'bold', minWidth: 80 }}>
                        {ticker}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedTickers.map((rowTicker, i) => (
                    <TableRow key={rowTicker}>
                      <TableCell sx={{ fontWeight: 'medium' }}>{rowTicker}</TableCell>
                      {selectedTickers.map((colTicker, j) => {
                        const correlation = correlationMatrix[i]?.[j] || 0;
                        return (
                          <TableCell key={colTicker} align="center">
                            <Box
                              sx={{
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                bgcolor: getCorrelationColor(correlation),
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                minWidth: 50
                              }}
                            >
                              {correlation.toFixed(2)}
                            </Box>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Correlation strength:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#9c27b0', borderRadius: 1 }} />
                  <Typography variant="caption">Strong Negative</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#2196f3', borderRadius: 1 }} />
                  <Typography variant="caption">Moderate Negative</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#4caf50', borderRadius: 1 }} />
                  <Typography variant="caption">Low</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#ff9800', borderRadius: 1 }} />
                  <Typography variant="caption">Moderate Positive</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#d32f2f', borderRadius: 1 }} />
                  <Typography variant="caption">Strong Positive</Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default OptimalPortfolioChart;
