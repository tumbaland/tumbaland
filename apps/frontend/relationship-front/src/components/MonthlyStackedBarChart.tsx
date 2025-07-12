import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip
} from '@mui/material';
import { getMonthlyStatistics, MonthlyStatisticsData } from '../api/statistics';

interface StackedBarChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COLORS = {
  daysWithSex: '#e91e63', // Pink for sex days
  daysMet: '#2196f3', // Blue for days met (without sex)
  daysNotMet: '#f5f5f5' // Light gray for days not met
};

const LEGEND_ITEMS = [
  { key: 'daysWithSex', label: 'Make Love', color: COLORS.daysWithSex },
  { key: 'daysMet', label: 'Just Meet', color: COLORS.daysMet },
  { key: 'daysNotMet', label: 'Miss You', color: COLORS.daysNotMet }
];

const MonthlyStackedBarChart: React.FC<StackedBarChartProps> = ({
  title = 'Monthly Days Breakdown',
  year,
  height = 400
}) => {
  const [data, setData] = useState<MonthlyStatisticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  // Generate available years (from 2024 to current year)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const monthlyData = await getMonthlyStatistics(selectedYear);
        console.log('Fetched monthly statistics:', monthlyData); // Debug log
        setData(monthlyData);
      } catch (err) {
        console.error('Error fetching monthly statistics:', err); // Debug log
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  const maxDays = Math.max(...data.map((d) => d.totalDays), 31);

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
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          {LEGEND_ITEMS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              size="small"
              sx={{
                backgroundColor: item.color,
                color: item.key === 'daysNotMet' ? '#666' : 'white',
                '& .MuiChip-label': {
                  fontSize: '0.75rem'
                }
              }}
            />
          ))}
        </Box>

        <Box sx={{ position: 'relative', height: height - 120, mt: 2, mb: 4 }}>
          {/* Y-axis labels */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: 40,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              pr: 1
            }}
          >
            {[maxDays, Math.round(maxDays * 0.75), Math.round(maxDays * 0.5), Math.round(maxDays * 0.25), 0].map(
              (value, index) => (
                <Typography key={index} variant="caption" color="text.secondary">
                  {value}
                </Typography>
              )
            )}
          </Box>

          {/* Chart area */}
          <Box
            sx={{
              ml: 5,
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              borderLeft: '1px solid #e0e0e0',
              borderBottom: '1px solid #e0e0e0',
              position: 'relative'
            }}
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio, index) => (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${ratio * 100}%`,
                  height: '1px',
                  backgroundColor: '#f0f0f0',
                  zIndex: 1
                }}
              />
            ))}{' '}
            {/* Stacked Bars */}
            {data.map((item) => {
              const monthIndex = parseInt(item.month) - 1;
              const monthName = MONTHS[monthIndex] || `M${item.month}`;

              // Calculate heights as percentages of the container
              const totalBarHeight = (item.totalDays / maxDays) * 100;
              const daysWithSexHeight = (item.daysWithSex / maxDays) * 100;
              const daysMetWithoutSexHeight = ((item.daysMet - item.daysWithSex) / maxDays) * 100;
              const daysNotMetHeight = (item.daysNotMet / maxDays) * 100;

              console.log('Stacked bar data:', {
                item,
                totalBarHeight,
                daysWithSexHeight,
                daysMetWithoutSexHeight,
                daysNotMetHeight,
                monthName,
                maxDays
              });

              return (
                <Box
                  key={`${item.year}-${item.month}`}
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    mx: 0.5,
                    cursor: 'pointer',
                    zIndex: 2,
                    height: '100%',
                    position: 'relative'
                  }}
                >
                  {/* Single container for all segments */}
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 40,
                      height: `${Math.max(totalBarHeight, 2)}%`,
                      position: 'relative',
                      border: '1px solid #ccc' // Debug border
                    }}
                  >
                    {' '}
                    {/* Days with sex (bottom segment) - positioned absolutely */}
                    {item.daysWithSex > 0 && (
                      <Tooltip title={`${monthName} ${item.year}: ${item.daysWithSex} days with sex`} arrow>
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${(daysWithSexHeight / totalBarHeight) * 100}%`,
                            backgroundColor: COLORS.daysWithSex,
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                              backgroundColor: '#c2185b'
                            }
                          }}
                        >
                          {/* Always show number, adjust font size for small segments */}
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: (daysWithSexHeight / totalBarHeight) * 100 > 25 ? '0.7rem' : '0.6rem',
                              fontWeight: 'bold',
                              color: 'white',
                              textAlign: 'center',
                              lineHeight: 1
                            }}
                          >
                            {item.daysWithSex}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {/* Days met without sex (middle segment) */}
                    {item.daysMet - item.daysWithSex > 0 && (
                      <Tooltip
                        title={`${monthName} ${item.year}: ${item.daysMet - item.daysWithSex} days met (no sex)`}
                        arrow
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: `${(daysWithSexHeight / totalBarHeight) * 100}%`,
                            left: 0,
                            right: 0,
                            height: `${(daysMetWithoutSexHeight / totalBarHeight) * 100}%`,
                            backgroundColor: COLORS.daysMet,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                              backgroundColor: '#1976d2'
                            }
                          }}
                        >
                          {/* Always show number, adjust font size for small segments */}
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: (daysMetWithoutSexHeight / totalBarHeight) * 100 > 25 ? '0.7rem' : '0.6rem',
                              fontWeight: 'bold',
                              color: 'white',
                              textAlign: 'center',
                              lineHeight: 1
                            }}
                          >
                            {item.daysMet - item.daysWithSex}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {/* Days not met (top segment) */}
                    {item.daysNotMet > 0 && (
                      <Tooltip title={`${monthName} ${item.year}: ${item.daysNotMet} days not met`} arrow>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: `${(daysNotMetHeight / totalBarHeight) * 100}%`,
                            backgroundColor: COLORS.daysNotMet,
                            borderRadius: '4px 4px 0 0',
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                              backgroundColor: '#e0e0e0'
                            }
                          }}
                        >
                          {/* Always show number, adjust font size for small segments */}
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: (daysNotMetHeight / totalBarHeight) * 100 > 25 ? '0.7rem' : '0.6rem',
                              fontWeight: 'bold',
                              color: '#666',
                              textAlign: 'center',
                              lineHeight: 1
                            }}
                          >
                            {item.daysNotMet}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}
                  </Box>

                  {/* Month label */}
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      bottom: -30,
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'center',
                      whiteSpace: 'nowrap',
                      fontSize: '0.75rem'
                    }}
                  >
                    {monthName}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Summary stats */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            justifyContent: 'space-around',
            pt: 2,
            borderTop: '1px solid #e0e0e0'
          }}
        >
          <Box textAlign="center">
            <Typography variant="h6" color="error">
              {data.reduce((sum, item) => sum + item.daysWithSex, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Love Days
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.reduce((sum, item) => sum + item.daysMet, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Days Met
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="text.secondary">
              {data.reduce((sum, item) => sum + item.daysNotMet, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Days Not Met
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MonthlyStackedBarChart;
