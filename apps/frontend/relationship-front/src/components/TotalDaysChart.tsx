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
  missYou: '#90a4ae' // Blue-grey for days not met, dark enough for white text
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
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
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

  // Create series for each category
  const madeLoveData = data.map((item) => item.daysWithSex);
  // Just Meet is (Days Met) - (Days with Sex) to ensure they sum up to Total Met Days without intersection
  const justMeetData = data.map((item) => Math.max(0, item.daysMet - item.daysWithSex));
  const missYouData = data.map((item) => {
    const calendarDays = getDaysInMonth(item.year, parseInt(item.month));
    return Math.max(0, calendarDays - item.daysMet);
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
  const totalJustMeet = data.reduce((sum, item) => sum + Math.max(0, item.daysMet - item.daysWithSex), 0);
  const totalMissYou = data.reduce((sum, item) => {
    const calendarDays = getDaysInMonth(item.year, parseInt(item.month));
    return sum + Math.max(0, calendarDays - item.daysMet);
  }, 0);

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

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {LEGEND_ITEMS.map((item) => {
            const totals = {
              madeLove: totalMadeLove,
              justMeet: totalJustMeet,
              missYou: totalMissYou
            };
            const count = totals[item.key as keyof typeof totals];

            return (
              <Chip
                key={item.key}
                label={`${item.label} (${count})`}
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
              max: 31,
              ...(isMobile ? {} : { label: 'Days' }) // Only show label on non-mobile
            }]}
            series={series.map((item) => ({ ...item, barLabel: 'value' }))}
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
            <Typography variant="h6" color="error" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalMadeLove}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '0.7rem', sm: '0.75rem' }
              }}>
              Total Love Days
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              {totalJustMeet}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '0.7rem', sm: '0.75rem' }
              }}>
              Total Meet Days
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
            <Typography
              variant="h6"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '1.1rem', sm: '1.25rem' }
              }}>
              {totalMissYou}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: { xs: '0.7rem', sm: '0.75rem' }
              }}>
              Days Not Met
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TotalDaysChart;