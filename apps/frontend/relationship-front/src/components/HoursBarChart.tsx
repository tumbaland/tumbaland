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
import { BarChart } from '@mui/x-charts';
import { getMonthlyActivityBreakdown, MonthlyActivityData } from '../api/statistics';
import { getActivityTypes } from '../api/activityTypes';
import { ActivityType } from '../api/types';
import { useTenantFilter } from './tenant';

interface BarChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HoursBarChart: React.FC<BarChartProps> = ({ title = 'Activities per Month by Type', year, height = 400 }) => {
  const [data, setData] = useState<MonthlyActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

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
      const [monthlyData, activityTypesResponse] = await Promise.all([
        getMonthlyActivityBreakdown(selectedYear, tenantGroupId),
        getActivityTypes({ groupId: tenantGroupId })
      ]);
      setData(monthlyData);
      setActivityTypes(activityTypesResponse.data);
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
      <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
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
      <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight="bold">
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
          <Typography variant="h6" gutterBottom fontWeight="bold">
            {title}
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" height={height}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Get all unique activity types from the data
  const allActivityTypes = Array.from(
    new Set(
      data.flatMap(month =>
        Object.keys(month.activities)
      )
    )
  ).filter(type => !['sex', 'together'].includes(type));

  // Prepare data for the chart - create arrays for each activity type
  const monthLabels = data.map((item) => `${MONTHS[parseInt(item.month) - 1]} ${item.year}`);

  console.log('Raw data:', data);
  console.log('All activity types:', allActivityTypes);

  // Recalculate totals based on filtered activities
  const totalPerMonth = data.map(item => {
    return allActivityTypes.reduce((sum, type) => {
      return sum + (item.activities[type]?.count || 0);
    }, 0);
  });

  const totalActivities = totalPerMonth.reduce((sum, val) => sum + val, 0);
  const avgActivities = Math.round(totalActivities / data.length || 0);
  const peakActivities = Math.max(...totalPerMonth, 0);

  // Create series for each activity type with direct data arrays
  const generatedSeries = allActivityTypes.map(activityType => {
    const activityTypeData = activityTypes.find(type => type.slug === activityType);
    const activityCounts = data.map((item) => {
      const activityData = item.activities[activityType];
      return activityData ? activityData.count : 0;
    });

    return {
      data: activityCounts,
      label: activityTypeData?.name || activityType,
      stack: 'activities',
      color: activityTypeData?.color || '#9e9e9e'
    };
  });

  const series = [
    ...generatedSeries,
    {
      data: data.map(() => 0),
      label: 'Total',
      stack: 'activities',
      color: 'transparent',
      id: 'total-series',
      valueFormatter: () => '', // Hide value in tooltip
    }
  ];

  console.log('Month labels:', monthLabels);
  console.log('Series:', series);

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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">{title}</Typography>
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

        {/* Legend */}
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {allActivityTypes
            .map((activityType) => {
            const activityTypeData = activityTypes.find(type => type.slug === activityType);
            const totalCount = data.reduce((sum, month) => sum + (month.activities[activityType]?.count || 0), 0);
            return (
              <Chip
                key={activityType}
                label={`${activityTypeData?.name || activityType} (${totalCount})`}
                size="small"
                sx={{
                  backgroundColor: activityTypeData?.color || '#9e9e9e',
                  color: 'white',
                  '& .MuiChip-label': {
                    fontSize: { xs: '0.65rem', sm: '0.75rem' }
                  },
                  minWidth: { xs: '60px', sm: 'auto' }
                }}
              />
            );
          })}
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
              ...(isMobile ? {} : { label: 'Activities' }) // Only show label on non-mobile
            }]}
            series={series}
            barLabel={(item) => {
              if ((item.seriesId as any) === 'total-series') {
                return totalPerMonth[item.dataIndex]?.toString();
              }
              return null;
            }}
            slotProps={{
              barLabel: {
                style: {
                  fill: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transform: 'translateY(-10px)'
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
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalActivities}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Total Activities
            </Typography>
          </Box>
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {avgActivities}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Avg Activities per Month
            </Typography>
          </Box>
          <Box textAlign="center" sx={{ minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {peakActivities}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Peak Activities
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HoursBarChart;
