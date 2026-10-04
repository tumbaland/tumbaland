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
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { getMonthlyStatistics, MonthlyStatisticsData } from '../services/statistics';
import { ActivityType } from '../services/types';

interface TotalDaysChartProps {
  title?: string;
  year?: number;
  height?: number;
  /**
   * Optional highlighted activity type: its days get their own colored
   * segment, split out of the overall "days with entries" count.
   */
  featuredType?: ActivityType;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COLOR_TOGETHER = '#2196f3'; // days with entries (not featured)
const COLOR_APART = '#90a4ae'; // days without any entry

// Helper function to get total days in a month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const TotalDaysChart: React.FC<TotalDaysChartProps> = ({
  title = 'Monthly Days Breakdown',
  year,
  height = 400,
  featuredType
}) => {
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
      logger.error('Error fetching data', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, tenantGroupId]);

  if (loading) {
    return (
      <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: height }}>
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
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
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
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: height }}>
            <Typography sx={{ color: 'text.secondary' }}>No data available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the chart
  const monthLabels = data.map((item) => `${MONTHS[parseInt(item.month) - 1]} ${item.year}`);

  const featuredDaysFor = (item: MonthlyStatisticsData): number =>
    featuredType ? item.types.find((t) => t.slug === featuredType.slug)?.uniqueDays || 0 : 0;

  const featuredData = data.map(featuredDaysFor);
  // remaining days with entries, so the segments sum to daysWithEntries
  const togetherData = data.map((item) => Math.max(0, item.daysWithEntries - featuredDaysFor(item)));
  const apartData = data.map((item) => {
    const calendarDays = getDaysInMonth(item.year, parseInt(item.month));
    return Math.max(0, calendarDays - item.daysWithEntries);
  });

  const featuredLabel = featuredType ? `${featuredType.name} days` : '';
  const togetherLabel = featuredType ? 'Other days together' : 'Days together';
  const apartLabel = 'Days apart';
  const featuredColor = featuredType?.color || theme.palette.error.main;

  const series = [
    ...(featuredType ? [{ data: featuredData, label: featuredLabel, stack: 'days', color: featuredColor }] : []),
    { data: togetherData, label: togetherLabel, stack: 'days', color: COLOR_TOGETHER },
    { data: apartData, label: apartLabel, stack: 'days', color: COLOR_APART }
  ];

  const totalFeatured = featuredData.reduce((sum, v) => sum + v, 0);
  const totalTogether = togetherData.reduce((sum, v) => sum + v, 0);
  const totalApart = apartData.reduce((sum, v) => sum + v, 0);

  const legendItems = [
    ...(featuredType
      ? [{ key: 'featured', label: featuredLabel, color: featuredColor, count: totalFeatured, textColor: 'white' }]
      : []),
    { key: 'together', label: togetherLabel, color: COLOR_TOGETHER, count: totalTogether, textColor: 'white' },
    { key: 'apart', label: apartLabel, color: COLOR_APART, count: totalApart, textColor: '#666' }
  ];

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
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
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
          {legendItems.map((item) => (
            <Chip
              key={item.key}
              label={`${item.label} (${item.count})`}
              size="small"
              sx={{
                backgroundColor: item.color,
                color: item.textColor,
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
            xAxis={[
              {
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
                    return value === monthLabels[0] || parts[0] === 'Jan' ? parts[1] : '';
                  }
                  return value;
                }
              }
            ]}
            yAxis={[
              {
                max: 31,
                ...(isMobile ? {} : { label: 'Days' }) // Only show label on non-mobile
              }
            ]}
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
            borderTop: '1px solid var(--mui-palette-divider)',
            flexWrap: 'wrap',
            gap: { xs: 2, sm: 0 }
          }}
        >
          {legendItems.map((item) => (
            <Box key={item.key} sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
              <Typography variant="h6" sx={{ color: item.color, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                {item.count}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }
                }}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default TotalDaysChart;
