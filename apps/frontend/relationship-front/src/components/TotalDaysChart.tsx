import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { getMonthlyStatistics, MonthlyStatisticsData } from '../api/statistics';
import { useTenantFilter } from './tenant';

interface TotalDaysChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COLORS = {
  madeLove: '#e91e63', // Pink for sex days
  justMeet: '#2196f3', // Blue for days met without sex
  missYou: '#f5f5f5' // Light gray for days not met
};

const LEGEND_ITEMS = [
  { key: 'madeLove', label: 'Made Love', color: COLORS.madeLove },
  { key: 'justMeet', label: 'Just Meet', color: COLORS.justMeet },
  { key: 'missYou', label: 'Miss You', color: COLORS.missYou }
];

// Helper function to get total days in a month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const TotalDaysChart: React.FC<TotalDaysChartProps> = ({ title = 'Monthly Days Breakdown', year, height = 400 }) => {
  const [data, setData] = useState<MonthlyStatisticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  // Generate available years (from 2024 to current year)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const monthlyData = await getMonthlyStatistics(selectedYear, tenantGroupId);
      setData(monthlyData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, tenantGroupId]);

  if (loading) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the chart
  const monthLabels = data.map((item) => `${MONTHS[parseInt(item.month) - 1]} ${item.year}`);

  // Create series for each category
  const madeLoveData = data.map((item) => item.daysWithSex);
  const justMeetData = data.map((item) => item.daysMet - item.daysWithSex);
  const missYouData = data.map((item) => {
    const calendarDays = getDaysInMonth(item.year, parseInt(item.month));
    return calendarDays - item.daysMet;
  });

  const series = [
    {
      data: madeLoveData,
      label: 'Made Love',
      stack: 'days',
      color: COLORS.madeLove
    },
    {
      data: justMeetData,
      label: 'Just Meet',
      stack: 'days',
      color: COLORS.justMeet
    },
    {
      data: missYouData,
      label: 'Miss You',
      stack: 'days',
      color: COLORS.missYou
    }
  ];

  const totalMadeLove = data.reduce((sum, item) => sum + item.daysWithSex, 0);
  const totalJustMeet = data.reduce((sum, item) => sum + (item.daysMet - item.daysWithSex), 0);
  const totalMissYou = data.reduce((sum, item) => {
    const calendarDays = getDaysInMonth(item.year, parseInt(item.month));
    return sum + (calendarDays - item.daysMet);
  }, 0);

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{title}</Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear || 'all'}
              label="Year"
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? undefined : Number(e.target.value))}
            >
              <MenuItem value="all">All Years</MenuItem>
              {availableYears.map((yearOption) => (
                <MenuItem key={yearOption} value={yearOption}>
                  {yearOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {LEGEND_ITEMS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              size="small"
              sx={{
                backgroundColor: item.color,
                color: item.key === 'missYou' ? '#666' : 'white',
                '& .MuiChip-label': {
                  fontSize: { xs: '0.65rem', sm: '0.75rem' }
                },
                minWidth: { xs: '60px', sm: 'auto' }
              }}
            />
          ))}
        </Box>

        <Box sx={{ width: '100%', height: height - 100 }}>
          <BarChart
            xAxis={[{ scaleType: 'band', data: monthLabels }]}
            yAxis={[{ 
              max: 31,
              ...(isMobile ? {} : { label: 'Days' }) // Only show label on non-mobile
            }]}
            series={series}
            height={height - 130}
            margin={{ 
              top: 10, 
              right: 15, // Reduced right margin
              bottom: 10, // Further reduced bottom margin
              left: isMobile ? 15 : 50 // Further reduced left margins
            }}
          />
        </Box>

        {/* Summary stats */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            justifyContent: 'space-around',
            pt: 2,
            borderTop: '1px solid #e0e0e0',
            flexWrap: 'wrap',
            gap: { xs: 2, sm: 0 }
          }}
        >
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="error" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalMadeLove}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Total Love Days
            </Typography>
          </Box>
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalJustMeet}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Total Meet Days
            </Typography>
          </Box>
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalMissYou}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Days Not Met
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TotalDaysChart;