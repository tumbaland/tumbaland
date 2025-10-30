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
  useMediaQuery
} from '@mui/material';
import { Timeline } from '@mui/icons-material';
import { LineChart } from '@mui/x-charts';

interface FinanceRecord {
  _id: string;
  date: string;
  secondPillar: number;
  thirdPillar: number;
  etfPortfolio: number;
  cash: number;
  gold: number;
}

interface PortfolioValueChartProps {
  records: FinanceRecord[];
}

const PortfolioValueChart: React.FC<PortfolioValueChartProps> = ({ records }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [timePeriod, setTimePeriod] = useState<string>('2');
  const [useLogScale, setUseLogScale] = useState<boolean>(false);

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

    const series = [
      {
        id: 'total',
        label: 'Total Portfolio',
        data: filteredRecords.map(record =>
          record.secondPillar + record.thirdPillar + record.etfPortfolio + record.cash + record.gold
        ),
        color: '#000000',
        showMark: false,
        curve: 'monotoneX' as const
      },
      {
        id: 'secondPillar',
        label: 'Second Pillar',
        data: filteredRecords.map(record => record.secondPillar),
        color: '#3b82f6',
        showMark: false,
        curve: 'monotoneX' as const
      },
      {
        id: 'thirdPillar',
        label: 'Third Pillar',
        data: filteredRecords.map(record => record.thirdPillar),
        color: '#1d4ed8',
        showMark: false,
        curve: 'monotoneX' as const
      },
      {
        id: 'etfPortfolio',
        label: 'ETF Portfolio',
        data: filteredRecords.map(record => record.etfPortfolio),
        color: '#ef4444',
        showMark: false,
        curve: 'monotoneX' as const
      },
      {
        id: 'cash',
        label: 'Cash',
        data: filteredRecords.map(record => record.cash),
        color: '#22c55e',
        showMark: false,
        curve: 'monotoneX' as const
      },
      {
        id: 'gold',
        label: 'Gold',
        data: filteredRecords.map(record => record.gold),
        color: '#eab308',
        showMark: false,
        curve: 'monotoneX' as const
      }
    ].filter(series => {
      // For log scale, only include series with all positive values
      if (useLogScale) {
        return series.data.every(value => value > 0);
      }
      // For linear scale, include series with at least one non-zero value
      return series.data.some(value => value > 0);
    });

    return { dates, series };
  }, [filteredRecords, useLogScale]);

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
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          height: '100%'
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Timeline sx={{ mr: 2, color: '#667eea' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Portfolio Value Over Time
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No data available to display portfolio timeline
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Timeline sx={{ mr: 2, color: '#667eea' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Portfolio Value Over Time
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
        <Box sx={{ width: '100%', height: 350 }}>
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
              label: isMobile ? '' : 'Portfolio Value (€)',
              labelStyle: { textAnchor: 'middle' },
              scaleType: useLogScale ? 'log' : 'linear'
            }]}
            series={portfolioTimelineData.series}
            height={350}
            margin={{
              top: 20,
              right: isMobile ? 20 : 30,
              bottom: 60,
              left: isMobile ? 20 : 80
            }}
            grid={{ horizontal: true, vertical: false }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PortfolioValueChart;