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
  useTheme,
  useMediaQuery
} from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { getMonthlyActivityBreakdown, MonthlyActivityData } from '../api/statistics';
import { useTenantFilter } from './tenant';

interface TotalHoursChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TotalHoursChart: React.FC<TotalHoursChartProps> = ({ title = 'Total Hours per Month', year, height = 400 }) => {
  const [data, setData] = useState<MonthlyActivityData[]>([]);
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
      const monthlyData = await getMonthlyActivityBreakdown(selectedYear, tenantGroupId);
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
  const hoursData = data.map((item) => item.totalHours);

  const totalHours = data.reduce((sum, item) => sum + item.totalHours, 0);
  const avgHours = Math.round(totalHours / data.length || 0);
  const peakHours = Math.max(...data.map((d) => d.totalHours));

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

        <Box sx={{ width: '100%', height: height - 100 }}>
          <BarChart
            xAxis={[{ scaleType: 'band', data: monthLabels }]}
            yAxis={[{ 
              ...(isMobile ? {} : { label: 'Hours' }) // Only show label on non-mobile
            }]}
            series={[{
              data: hoursData,
              label: 'Total Hours',
              color: '#1976d2'
            }]}
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
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalHours}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Total Hours
            </Typography>
          </Box>
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {avgHours}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Avg Hours per Month
            </Typography>
          </Box>
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {peakHours}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Peak Hours
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TotalHoursChart;