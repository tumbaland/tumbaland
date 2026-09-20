import React, { useEffect, useState } from 'react';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { logger } from '@tumbaland/frontend-core';
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
import { getMonthlyActivityBreakdown, MonthlyActivityData } from '../services/statistics';

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
      logger.error('Error fetching data', err);
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
      <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{
            fontWeight: "bold"
          }}>
            {title}
          </Typography>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: height
            }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{
            fontWeight: "bold"
          }}>
            {title}
          </Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{
            fontWeight: "bold"
          }}>
            {title}
          </Typography>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: height
            }}>
            <Typography sx={{
              color: "text.secondary"
            }}>No data available</Typography>
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
    <Card 
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{
            fontWeight: "bold"
          }}>{title}</Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear || 'all'}
              label="Year"
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? undefined : Number(e.target.value))}
              sx={{ borderRadius: 2 }}
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
            xAxis={[{ 
              scaleType: 'band', 
              data: monthLabels,
              tickLabelStyle: {
                angle: 0,
                textAnchor: 'middle',
                fontSize: 12
              },
              valueFormatter: (value: string, context) => {
                const parts = value.split(' ');
                if (context.location === 'tick') {
                  return (value === monthLabels[0] || parts[0] === 'Jan') ? parts[1] : '';
                }
                return value;
              }
            }]}
            yAxis={[{ 
              ...(isMobile ? {} : { label: 'Hours' }) // Only show label on non-mobile
            }]}
            series={[{
              data: hoursData,
              label: `Total Hours (${totalHours})`,
              color: '#1976d2',
              valueFormatter: (value) => `${value} hours`,
              barLabel: (item) => item.value?.toString()
            }]}
            slotProps={{
              barLabel: {
                style: {
                  fill: '#fff',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }
              }
            }}
            height={height - 130}
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
          <Box sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalHours}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}>
              Total Hours
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {avgHours}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '0.7rem', sm: '0.75rem' }
              }}>
              Avg Hours per Month
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {peakHours}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '0.7rem', sm: '0.75rem' }
              }}>
              Peak Hours
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TotalHoursChart;