import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { TrendingUp } from '@mui/icons-material';

interface YearlyResult {
  year: number;
  moneyInvested: number;
  gainFromMarket: number;
  portfolioTotalValue: number;
  inflationAdjustedValue: number;
}

interface StockGrowthChartProps {
  data: YearlyResult[];
  goal?: number;
  mcBands?: { years: number[]; p10: number[]; p50: number[]; p90: number[] };
}

const StockGrowthChart: React.FC<StockGrowthChartProps> = ({ data, goal, mcBands }) => {
  const [containerWidth, setContainerWidth] = React.useState(800);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 48); // Account for padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <TrendingUp sx={{ mr: 1 }} />
            Growth Projection Chart
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No data available to display chart
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const chartLines = [
    { 
      key: 'portfolioTotalValue', 
      label: 'Portfolio Total Value', 
      color: '#1976d2' 
    },
    { 
      key: 'moneyInvested', 
      label: 'Money Invested', 
      color: '#2e7d32' 
    },
    { 
      key: 'inflationAdjustedValue', 
      label: 'Inflation Adjusted Value', 
      color: '#ed6c02' 
    }
  ];

  // State for toggling line visibility
  const [visibleLines, setVisibleLines] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(chartLines.map((line) => [line.key, true]))
  );

  // Calculate max value based only on visible lines
  const maxValue = Math.max(
    ...data.flatMap((item) =>
      chartLines
        .filter((line) => visibleLines[line.key])
        .map((line) => item[line.key as keyof YearlyResult] as number)
    )
  );
  const mcMax = mcBands ? Math.max(...mcBands.p90) : 0;
  const maxWithGoal = goal ? Math.max(maxValue, goal, mcMax) : Math.max(maxValue, mcMax);

  const toggleLine = (key: string) => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chartHeight = 400;
  const chartWidth = containerWidth;
  const padding = 80;

  const getXPosition = (index: number) => {
    return padding + (index * (chartWidth - 2 * padding)) / (data.length - 1);
  };

  const getYPosition = (value: number) => {
    return chartHeight - padding - (value / maxWithGoal) * (chartHeight - 2 * padding);
  };

  const createPathData = (lineKey: keyof YearlyResult) => {
    return data
      .map((item, index) => {
        const x = getXPosition(index);
        const y = getYPosition(item[lineKey] as number);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const createBandPath = (years: number[], upper: number[], lower: number[]) => {
    if (years.length === 0) return '';
    // Upper from left to right
    const upperPath = years
      .map((year, i) => `L ${getXPosition(year - 1)} ${getYPosition(upper[i])}`)
      .join(' ')
      .replace(/^L/, 'M');
    // Lower from right to left
    const lowerPath = years
      .slice()
      .reverse()
  .map((_, idx) => `L ${getXPosition(years.length - 1 - idx)} ${getYPosition(lower[years.length - 1 - idx])}`)
      .join(' ');
    return `${upperPath} ${lowerPath} Z`;
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUp sx={{ mr: 1 }} />
          Growth Projection Chart
        </Typography>

        {/* Legend with toggles */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {chartLines.map((line) => (
            <Box
              key={line.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                opacity: visibleLines[line.key] ? 1 : 0.4,
                border: visibleLines[line.key] ? '2px solid ' + line.color : '2px solid transparent',
                borderRadius: 2,
                px: 1,
                py: 0.5,
                userSelect: 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => toggleLine(line.key)}
            >
              <Box
                sx={{
                  width: 16,
                  height: 3,
                  bgcolor: line.color,
                  mr: 1,
                  borderRadius: 1
                }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                {line.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Chart Container */}
        <Box ref={containerRef} sx={{ width: '100%', mb: 2 }}>
          <svg
            key={Object.values(visibleLines).join('-')}
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ display: 'block' }}
          >
            {/* Grid lines */}
            <defs>
              <pattern id="growthGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#growthGrid)" />

            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const value = maxWithGoal * ratio;
              const y = getYPosition(value);
              return (
                <g key={ratio}>
                  <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#e0e0e0" strokeWidth="1" />
                  <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                    {formatCurrency(value)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels (Years) */}
            {data.map((item, index) => {
              // Show every 5th year or first/last
              if (index % 5 === 0 || index === data.length - 1) {
                const x = getXPosition(index);
                return (
                  <text key={item.year} x={x} y={chartHeight - padding + 20} textAnchor="middle" fontSize="12" fill="#666">
                    {item.year}
                  </text>
                );
              }
              return null;
            })}

            {/* Chart lines */}
            {chartLines
              .filter((line) => visibleLines[line.key])
              .map((line) => (
                <g key={line.key}>
                  <path
                    d={createPathData(line.key as keyof YearlyResult)}
                    fill="none"
                    stroke={line.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Data points */}
                  {data.map((item, index) => {
                    const x = getXPosition(index);
                    const y = getYPosition(item[line.key as keyof YearlyResult] as number);
                    return (
                      <circle key={index} cx={x} cy={y} r="4" fill={line.color} stroke="white" strokeWidth="2">
                        <title>
                          {line.label}: {formatCurrency(item[line.key as keyof YearlyResult] as number)} in Year {item.year}
                        </title>
                      </circle>
                    );
                  })}
                </g>
              ))}

            {/* Monte Carlo band (p10 - p90) and median line */}
            {mcBands && (
              <g>
                {/* Shaded band p10-p90 */}
                <path
                  d={createBandPath(mcBands.years, mcBands.p90, mcBands.p10)}
                  fill="#9e9e9e"
                  opacity="0.15"
                  stroke="none"
                />
                {/* Band */}
                <path
                  d={mcBands.years
                    .map((year, i) => `L ${getXPosition(year - 1)} ${getYPosition(mcBands.p90[i])}`)
                    .join(' ')
                    .replace(/^L/, 'M')
                  }
                  fill="none"
                  stroke="#9e9e9e"
                  strokeWidth="1"
                  strokeDasharray="2,4"
                  opacity="0.8"
                />
                <path
                  d={mcBands.years
                    .slice().reverse()
                    .map((_, idx) => `L ${getXPosition(mcBands.years.length - 1 - idx)} ${getYPosition(mcBands.p10[mcBands.years.length - 1 - idx])}`)
                    .join(' ')
                    .replace(/^L/, 'M')
                  }
                  fill="none"
                  stroke="#9e9e9e"
                  strokeWidth="1"
                  strokeDasharray="2,4"
                  opacity="0.8"
                />
                {/* Median */}
                <path
                  d={mcBands.years
                    .map((year, i) => `L ${getXPosition(year - 1)} ${getYPosition(mcBands.p50[i])}`)
                    .join(' ')
                    .replace(/^L/, 'M')
                  }
                  fill="none"
                  stroke="#616161"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Goal line */}
            {goal && (
              <g>
                <line
                  x1={padding}
                  y1={getYPosition(goal)}
                  x2={chartWidth - padding}
                  y2={getYPosition(goal)}
                  stroke="#9c27b0"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
                <text x={chartWidth - padding} y={getYPosition(goal) - 6} textAnchor="end" fontSize="12" fill="#9c27b0">
                  Goal: {formatCurrency(goal)}
                </text>
              </g>
            )}
          </svg>
        </Box>

        {/* Summary stats */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 2,
            pt: 2,
            borderTop: '1px solid #e0e0e0',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 0 }
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Showing {data.length} years of projection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Final portfolio value: {formatCurrency(data[data.length - 1].portfolioTotalValue)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StockGrowthChart;
