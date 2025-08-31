import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { TrendingUp } from '@mui/icons-material';

interface FinanceRecord {
  _id: string;
  date: string;
  secondPillar: number;
  thirdPillar: number;
  etfPortfolio: number;
  cash: number;
  gold: number;
}

interface PortfolioChartProps {
  records: FinanceRecord[];
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ records }) => {
  const [containerWidth, setContainerWidth] = React.useState(800);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Add state for years to show
  const [yearsToShow, setYearsToShow] = React.useState<'All' | 1 | 3 | 5>(3);
  // Add state for logarithmic scale
  const [useLogScale, setUseLogScale] = React.useState(true);

  // Handler for dropdown (fix type)
  const handleYearsChange = (event: SelectChangeEvent<'All' | 1 | 3 | 5>) => {
    const value = event.target.value;
    setYearsToShow(value === 'All' ? 'All' : (Number(value) as 1 | 3 | 5));
  };

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

  const formatDateForAxis = (dateString: string) => {
    return new Date(dateString).getFullYear().toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('et-EE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Sort records by date ascending for chronological display
  let sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Filter records by yearsToShow
  if (yearsToShow !== 'All' && sortedRecords.length > 0) {
    const lastDate = new Date(sortedRecords[sortedRecords.length - 1].date);
    const cutoffYear = lastDate.getFullYear() - (yearsToShow - 1);
    sortedRecords = sortedRecords.filter((r) => new Date(r.date).getFullYear() >= cutoffYear);
  }

  if (sortedRecords.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <TrendingUp sx={{ mr: 1 }} />
            Portfolio Trends
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No data available to display trends
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const assetClasses = [
    { key: 'secondPillar', label: 'Second Pillar', color: '#667eea' },
    { key: 'thirdPillar', label: 'Third Pillar', color: '#764ba2' },
    { key: 'etfPortfolio', label: 'ETF Portfolio', color: '#11998e' },
    { key: 'cash', label: 'Cash', color: '#38ef7d' },
    { key: 'gold', label: 'Gold', color: '#ffd700' }
  ];

  // State for toggling asset visibility
  const [visibleAssets, setVisibleAssets] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(assetClasses.map((a) => [a.key, true]))
  );

  // Calculate maxValue and minValue based only on visible assets
  const allValues = sortedRecords.flatMap((record) =>
    assetClasses.filter((a) => visibleAssets[a.key]).map((a) => record[a.key as keyof FinanceRecord] as number)
  );

  const positiveValues = allValues.filter(val => val > 0);
  const maxValue = Math.max(...allValues);
  const minValue = positiveValues.length > 0 ? Math.min(...positiveValues) : 1;

  const toggleAsset = (key: string) => {
    setVisibleAssets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chartHeight = 300;
  const chartWidth = containerWidth;
  const padding = 60;

  const getXPosition = (index: number) => {
    return padding + (index * (chartWidth - 2 * padding)) / (sortedRecords.length - 1);
  };

  const getYPosition = (value: number) => {
    if (useLogScale) {
      if (value <= 0) {
        // For zero or negative values in log scale, position at the bottom
        return chartHeight - padding;
      }
      // Use logarithmic scale for positive values
      const logMax = Math.log10(maxValue);
      const logMin = Math.log10(Math.max(minValue, 1));
      const logValue = Math.log10(value);
      const ratio = (logValue - logMin) / (logMax - logMin);
      return chartHeight - padding - ratio * (chartHeight - 2 * padding);
    } else {
      // Use linear scale
      return chartHeight - padding - (value / maxValue) * (chartHeight - 2 * padding);
    }
  };

  const createPathData = (assetKey: keyof FinanceRecord) => {
    // Find the first non-zero value index
    const firstNonZeroIndex = sortedRecords.findIndex(record => (record[assetKey] as number) > 0);
    
    // If no non-zero values found, return empty path
    if (firstNonZeroIndex === -1) return '';
    
    let lastValidValue = sortedRecords[firstNonZeroIndex][assetKey] as number;
    let isFirstPoint = true;
    
    return sortedRecords
      .map((record, index) => {
        const originalValue = record[assetKey] as number;
        
        // Skip points before the first non-zero value
        if (index < firstNonZeroIndex) return null;
        
        // For log scale, carry forward the last valid value when current value is 0
        let valueToUse = originalValue;
        if (useLogScale && originalValue <= 0) {
          valueToUse = lastValidValue;
        } else if (originalValue > 0) {
          lastValidValue = originalValue;
        }
        
        const x = getXPosition(index);
        const y = getYPosition(valueToUse);
        const command = isFirstPoint ? 'M' : 'L';
        isFirstPoint = false;
        return `${command} ${x} ${y}`;
      })
      .filter(Boolean) // Remove null entries
      .join(' ');
  };

  // Get unique years and space them evenly across the chart
  const uniqueYears = [...new Set(sortedRecords.map((record) => formatDateForAxis(record.date)))];
  const getYearLabelIndices = () => {
    if (uniqueYears.length <= 1) {
      return [0]; // Show first record if only one year
    }

    // Space years evenly across the chart width
    const indices = [];
    for (let i = 0; i < uniqueYears.length; i++) {
      const position = Math.round((i * (sortedRecords.length - 1)) / (uniqueYears.length - 1));
      indices.push(position);
    }
    return indices;
  };

  const yearLabelIndices = getYearLabelIndices();

  // Generate Y-axis label values based on scale type
  const getYAxisLabels = () => {
    if (useLogScale && minValue > 0) {
      // For log scale, use powers of 10
      const logMin = Math.log10(Math.max(minValue, 1));
      const logMax = Math.log10(maxValue);
      const labels = [];
      
      // Generate logarithmic intervals
      for (let i = 0; i <= 4; i++) {
        const logValue = logMin + (i / 4) * (logMax - logMin);
        const value = Math.pow(10, logValue);
        labels.push(value);
      }
      return labels;
    } else {
      // Linear scale intervals
      return [0, 0.25, 0.5, 0.75, 1].map(ratio => maxValue * ratio);
    }
  };

  const yAxisLabels = getYAxisLabels();

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUp sx={{ mr: 1 }} />
          Portfolio Trends Over Time {useLogScale && '(Logarithmic Scale)'}
        </Typography>

        {/* Years selector */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="years-to-show-label">Show Last</InputLabel>
            <Select labelId="years-to-show-label" value={yearsToShow} label="Show Last" onChange={handleYearsChange}>
              <MenuItem value="All">All Years</MenuItem>
              <MenuItem value={1}>1 Year</MenuItem>
              <MenuItem value={3}>3 Years</MenuItem>
              <MenuItem value={5}>5 Years</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Checkbox
                checked={useLogScale}
                onChange={(e) => setUseLogScale(e.target.checked)}
                size="small"
              />
            }
            label="Logarithmic Scale"
          />
        </Box>

        {/* Legend with toggles */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {assetClasses.map((asset) => (
            <Box
              key={asset.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                opacity: visibleAssets[asset.key] ? 1 : 0.4,
                border: visibleAssets[asset.key] ? '2px solid ' + asset.color : '2px solid transparent',
                borderRadius: 2,
                px: 1,
                py: 0.5,
                userSelect: 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => toggleAsset(asset.key)}
            >
              <Box
                sx={{
                  width: 16,
                  height: 3,
                  bgcolor: asset.color,
                  mr: 1,
                  borderRadius: 1
                }}
              />
              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                {asset.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Chart Container */}
        <Box ref={containerRef} sx={{ width: '100%', mb: 2 }}>
          <svg
            key={`${Object.values(visibleAssets).join('-')}-${useLogScale}`}
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ display: 'block' }}
          >
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Y-axis labels */}
            {yAxisLabels.map((value, index) => {
              const y = getYPosition(value);
              return (
                <g key={index}>
                  <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#e0e0e0" strokeWidth="1" />
                  <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                    {formatCurrency(value)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels (Years evenly spaced) */}
            {yearLabelIndices.map((index, i) => {
              if (index >= 0 && index < sortedRecords.length) {
                const x = getXPosition(index);
                const year = uniqueYears[i];
                return (
                  <text key={year} x={x} y={chartHeight - padding + 20} textAnchor="middle" fontSize="12" fill="#666">
                    {year}
                  </text>
                );
              }
              return null;
            })}

            {/* Asset lines */}
            {assetClasses
              .filter((asset) => visibleAssets[asset.key])
              .map((asset) => (
                <g key={asset.key}>
                  <path
                    d={createPathData(asset.key as keyof FinanceRecord)}
                    fill="none"
                    stroke={asset.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Data points */}
                  {sortedRecords.map((record, index) => {
                    const originalValue = record[asset.key as keyof FinanceRecord] as number;
                    
                    // Only render dots for actual non-zero values
                    if (originalValue <= 0) return null;
                    
                    const x = getXPosition(index);
                    const y = getYPosition(originalValue);
                    return (
                      <circle key={index} cx={x} cy={y} r="4" fill={asset.color} stroke="white" strokeWidth="2">
                        <title>
                          {asset.label}: {formatCurrency(originalValue)} on{' '}
                          {formatDate(record.date)}
                        </title>
                      </circle>
                    );
                  })}
                </g>
              ))}
          </svg>
        </Box>

        {/* Summary stats */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 2,
            pt: 2,
            borderTop: '1px solid #e0e0e0'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Showing {sortedRecords.length} data points
          </Typography>
          <Typography variant="body2" color="text.secondary">
            From {formatDate(sortedRecords[0].date)} to {formatDate(sortedRecords[sortedRecords.length - 1].date)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PortfolioChart;
