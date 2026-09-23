import React, { useState } from 'react';
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
  Switch,
  FormControlLabel,
  useTheme,
  useColorScheme,
  useMediaQuery
} from '@mui/material';
import { Timeline } from '@mui/icons-material';
import { LineChart } from '@mui/x-charts';

interface PortfolioHistoryData {
  date: string;
  totalValue: number;
  assetBreakdown?: {
    [assetClass: string]: number;
  };
}

interface PortfolioValueChartProps {
  records: PortfolioHistoryData[];
  assetColors?: { [assetClass: string]: string };
}

const PortfolioValueChart: React.FC<PortfolioValueChartProps> = ({ records, assetColors = {} }) => {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [timePeriod, setTimePeriod] = useState<string>('2');
  const [useLogScale, setUseLogScale] = useState<boolean>(false);
  const chartHeight = isMobile ? 260 : 350;

  // Filter records based on selected time period
  const filteredRecords = React.useMemo(() => {
    if (timePeriod === 'all' || !records.length) return records;

    const now = new Date();
    const yearsBack = parseInt(timePeriod);
    const cutoffDate = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());

    return records.filter(record => new Date(record.date) >= cutoffDate);
  }, [records, timePeriod]);

  // Prepare portfolio timeline data for LineChart
  const portfolioTimelineData = React.useMemo(() => {
    if (!filteredRecords.length) return { dates: [], series: [] };

    const dates = filteredRecords.map(record =>
      new Date(record.date).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    );

    // Collect all unique asset classes
    const allAssetClasses = new Set<string>();
    filteredRecords.forEach(record => {
      if (record.assetBreakdown) {
        Object.keys(record.assetBreakdown).forEach(assetClass => {
          allAssetClasses.add(assetClass);
        });
      }
    });

    const assetClasses = Array.from(allAssetClasses);

    // Create series for each asset class plus total
    const series = [
      {
        id: 'totalValue',
        label: 'Net worth',
        data: useLogScale
          ? filteredRecords.map(record => record.totalValue === 0 ? 0.01 : record.totalValue)
          : filteredRecords.map(record => record.totalValue),
        // Black on light, near-white on dark: a series colour is an SVG
        // attribute, where a CSS variable is not reliably resolved.
        color: colorScheme === 'dark' ? '#f5f2fa' : '#000000',
        showMark: false,
        curve: 'monotoneX' as const
      }
    ];

    // Add series for each asset class
    assetClasses.forEach((assetClass) => {
      const rawData = filteredRecords.map(record => record.assetBreakdown?.[assetClass] || 0);
      // For log scale, replace zeros with a very small positive value to avoid log(0) issues
      const processedData = useLogScale
        ? rawData.map(value => value === 0 ? 0.01 : value)
        : rawData;

      series.push({
        id: assetClass,
        label: assetClass,
        data: processedData,
        color: assetColors[assetClass] || '#667eea', // Use asset class color or fallback
        showMark: false,
        curve: 'monotoneX' as const
      });
    });

    return { dates, series };
  }, [filteredRecords, useLogScale, colorScheme]);

  // On a phone the axis has about 40px, so full amounts ("250 000") were cut
  // to "250…". Thousands as "250k" fit and read the same.
  const compactAmount = (value: number) =>
    Math.abs(value) >= 1_000_000
      ? `${+(value / 1_000_000).toFixed(1)}M`
      : Math.abs(value) >= 1_000
        ? `${Math.round(value / 1_000)}k`
        : `${Math.round(value)}`;

  const handleTimePeriodChange = (event: SelectChangeEvent<string>) => {
    setTimePeriod(event.target.value);
  };

  const handleLogScaleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUseLogScale(event.target.checked);
  };

  if (!filteredRecords.length) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          background: 'var(--tl-glass-background)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--tl-glass-border)',
          height: '100%'
        }}
      >
        <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 3 } }}>
            <Timeline sx={{ mr: { xs: 1, md: 2 }, color: '#667eea', fontSize: { xs: 20, md: 24 } }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
              Net Worth Over Time
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: { xs: 3, md: 6 } }}>
            <Typography variant="body1" sx={{
              color: "text.secondary"
            }}>
              No data available to display portfolio timeline
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1, md: 3 }, flexWrap: 'wrap', gap: { xs: 1, md: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Timeline sx={{ mr: { xs: 1, md: 2 }, color: '#667eea', fontSize: { xs: 20, md: 24 } }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
              Net Worth Over Time
            </Typography>
          </Box>

          {/* Period and log scale share one line under the title on a phone; they
              used to take a line each. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={timePeriod}
                label="Time Period"
                onChange={handleTimePeriodChange}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="1">Last 1 Year</MenuItem>
                <MenuItem value="2">Last 2 Years</MenuItem>
                <MenuItem value="3">Last 3 Years</MenuItem>
                <MenuItem value="5">Last 5 Years</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={useLogScale}
                  onChange={handleLogScaleToggle}
                  size="small"
                />
              }
              label="Log Scale"
              sx={{ ml: 0 }}
            />
          </Box>
        </Box>
        <Box sx={{ width: '100%', minHeight: chartHeight }}>
          <LineChart
            xAxis={[{
              data: portfolioTimelineData.dates,
              scaleType: 'point',
              tickLabelInterval: (_, index) => {
                const totalPoints = portfolioTimelineData.dates.length;
                if (isMobile) {
                  // On mobile, show only start and end labels
                  return index === 0 || index === totalPoints - 1;
                }
                // On desktop, show labels at: start, 25%, 50%, 75%, and end
                const keyIndices = [0, Math.floor(totalPoints * 0.25), Math.floor(totalPoints * 0.5), Math.floor(totalPoints * 0.75), totalPoints - 1];
                return keyIndices.includes(index);
              }
            }]}
            yAxis={[{
              label: isMobile ? '' : 'Net Worth (€)',
              labelStyle: { textAnchor: 'middle' },
              scaleType: useLogScale ? 'log' : 'linear',
              ...(isMobile ? { width: 40, valueFormatter: (value: number) => compactAmount(value) } : {})
            }]}
            series={portfolioTimelineData.series}
            height={chartHeight}
            margin={
              isMobile
                ? { top: 8, right: 28, bottom: 4, left: 0 }
                : { top: 20, right: 30, bottom: 60, left: 80 }
            }
            grid={{ horizontal: true, vertical: false }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PortfolioValueChart;