import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { Timeline } from '@mui/icons-material';

interface FrontierPoint {
  return: number;
  risk: number;
}

interface AssetStats {
  ticker: string;
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
}

interface OptimalPortfolio {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
}

interface EfficientFrontierChartProps {
  frontierData: FrontierPoint[];
  optimalPortfolio: OptimalPortfolio;
  assetStats: AssetStats[];
}

const EfficientFrontierChart: React.FC<EfficientFrontierChartProps> = ({
  frontierData,
  optimalPortfolio,
  assetStats
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

  if (frontierData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Timeline sx={{ mr: 1 }} />
            Efficient Frontier
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No efficient frontier data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const chartHeight = 400;
  const chartWidth = containerWidth;
  const padding = 80;

  // Calculate bounds
  const maxReturn = Math.max(...frontierData.map(p => p.return), ...assetStats.map(a => a.expectedReturn));
  const minReturn = Math.min(...frontierData.map(p => p.return), ...assetStats.map(a => a.expectedReturn));
  const maxRisk = Math.max(...frontierData.map(p => p.risk), ...assetStats.map(a => a.volatility));
  const minRisk = Math.min(...frontierData.map(p => p.risk), ...assetStats.map(a => a.volatility));

  const returnRange = maxReturn - minReturn;
  const riskRange = maxRisk - minRisk;

  const getXPosition = (risk: number) => {
    return padding + ((risk - minRisk) / riskRange) * (chartWidth - 2 * padding);
  };

  const getYPosition = (returnValue: number) => {
    return chartHeight - padding - ((returnValue - minReturn) / returnRange) * (chartHeight - 2 * padding);
  };

  // Create smooth path for efficient frontier using curves
  const createSmoothPath = (points: Array<{return: number, risk: number}>) => {
    if (points.length < 2) return '';
    
    const sortedPoints = points.sort((a, b) => a.risk - b.risk);
    
    // Convert to screen coordinates
    const screenPoints = sortedPoints.map(point => ({
      x: getXPosition(point.risk),
      y: getYPosition(point.return)
    }));
    
    if (screenPoints.length < 3) {
      // For 2 points, just draw a line
      return `M ${screenPoints[0].x} ${screenPoints[0].y} L ${screenPoints[1].x} ${screenPoints[1].y}`;
    }
    
    // Create a smooth spline using cardinal spline interpolation
    let path = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
    
    // Calculate control points for smooth curve
    const tension = 0.3; // Controls curve smoothness (0 = straight lines, 1 = very curved)
    
    for (let i = 1; i < screenPoints.length; i++) {
      const current = screenPoints[i];
      const previous = screenPoints[i - 1];
      const next = screenPoints[i + 1] || current;
      const beforePrevious = screenPoints[i - 2] || previous;
      
      // Calculate control points using cardinal spline formula
      const cp1x = previous.x + (current.x - beforePrevious.x) * tension;
      const cp1y = previous.y + (current.y - beforePrevious.y) * tension;
      
      const cp2x = current.x - (next.x - previous.x) * tension;
      const cp2y = current.y - (next.y - previous.y) * tension;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
    }
    
    return path;
  };

  const frontierPath = createSmoothPath(frontierData);

  // Calculate Capital Allocation Line (CAL) - the best possible straight line
  // This line goes from risk-free rate (0% risk) through the optimal portfolio
  const riskFreeRate = 2.0; // Assume 2% risk-free rate (could be passed as prop)
  const calStartX = getXPosition(0); // Risk-free asset has 0 risk
  const calStartY = getYPosition(riskFreeRate);
  const calEndX = getXPosition(optimalPortfolio.volatility * 2); // Extend line beyond optimal portfolio
  
  // Calculate the slope (Sharpe ratio) to find end point
  const slope = (optimalPortfolio.expectedReturn - riskFreeRate) / optimalPortfolio.volatility;
  const calEndReturn = riskFreeRate + slope * (optimalPortfolio.volatility * 2);
  const calEndY = getYPosition(calEndReturn);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <Timeline sx={{ mr: 1 }} />
          Efficient Frontier Analysis
        </Typography>

        {/* Legend */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 3, bgcolor: '#1976d2', mr: 1, borderRadius: 1 }} />
            <Typography variant="body2">Efficient Frontier</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 2, bgcolor: '#ff6b35', mr: 1, borderRadius: 1 }} />
            <Typography variant="body2">Capital Allocation Line</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#2e7d32', mr: 1, borderRadius: '50%' }} />
            <Typography variant="body2">Individual Assets</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#d32f2f', mr: 1, borderRadius: '50%' }} />
            <Typography variant="body2">Optimal Portfolio</Typography>
          </Box>
        </Box>

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
              <pattern id="frontierGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#frontierGrid)" />

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

            {/* Efficient Frontier Curve */}
            <path
              d={frontierPath}
              fill="none"
              stroke="#1976d2"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Capital Allocation Line (CAL) - Best possible straight line */}
            <line
              x1={calStartX}
              y1={calStartY}
              x2={calEndX}
              y2={calEndY}
              stroke="#ff6b35"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.8"
            >
              <title>Capital Allocation Line - Best risk/return ratio (Sharpe: {optimalPortfolio.sharpeRatio.toFixed(3)})</title>
            </line>

            {/* Risk-free rate point */}
            <circle
              cx={calStartX}
              cy={calStartY}
              r="4"
              fill="#ff6b35"
              stroke="white"
              strokeWidth="2"
            >
              <title>Risk-free rate: {riskFreeRate.toFixed(1)}%</title>
            </circle>

            {/* Individual Assets */}
            {assetStats.map((asset) => {
              const x = getXPosition(asset.volatility);
              const y = getYPosition(asset.expectedReturn);
              return (
                <g key={asset.ticker}>
                  <circle cx={x} cy={y} r="6" fill="#2e7d32" stroke="white" strokeWidth="2">
                    <title>{`${asset.ticker}: ${asset.expectedReturn.toFixed(1)}% return, ${asset.volatility.toFixed(1)}% risk`}</title>
                  </circle>
                  <text x={x + 10} y={y - 10} fontSize="10" fill="#2e7d32" fontWeight="bold">
                    {asset.ticker}
                  </text>
                </g>
              );
            })}

            {/* Optimal Portfolio */}
            <circle
              cx={getXPosition(optimalPortfolio.volatility)}
              cy={getYPosition(optimalPortfolio.expectedReturn)}
              r="8"
              fill="#d32f2f"
              stroke="white"
              strokeWidth="3"
            >
              <title>{`Optimal Portfolio: ${optimalPortfolio.expectedReturn.toFixed(1)}% return, ${optimalPortfolio.volatility.toFixed(1)}% risk, Sharpe: ${optimalPortfolio.sharpeRatio.toFixed(2)}`}</title>
            </circle>
          </svg>
        </Box>

        {/* Summary */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Optimal Portfolio Metrics:
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Expected Return</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {optimalPortfolio.expectedReturn.toFixed(2)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Risk (Volatility)</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {optimalPortfolio.volatility.toFixed(2)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Sharpe Ratio</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {optimalPortfolio.sharpeRatio.toFixed(3)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EfficientFrontierChart;
