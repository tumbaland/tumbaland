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
import { getMonthlyActivityBreakdown, MonthlyActivityData } from '../api/statistics';

interface ActivityStackedBarChartProps {
  title?: string;
  year?: number;
  height?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Activity colors for visual consistency (excluding together and sex)
const ACTIVITY_COLORS: { [key: string]: string } = {
  movies: '#e53e3e',
  cooking: '#38a169',
  dining: '#ed8936',
  coffee: '#8b4513',
  gaming: '#9f7aea',
  other: '#718096'
};

// Activity labels for better display (excluding together and sex)
const ACTIVITY_LABELS: { [key: string]: string } = {
  movies: 'Movies',
  cooking: 'Cooking',
  dining: 'Dining',
  coffee: 'Coffee',
  gaming: 'Gaming',
  other: 'Other'
};

const ActivityStackedBarChart: React.FC<ActivityStackedBarChartProps> = ({
  title = 'Monthly Activities',
  year,
  height = 500
}) => {
  const [data, setData] = useState<MonthlyActivityData[]>([]);
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
        const monthlyData = await getMonthlyActivityBreakdown(selectedYear);
        console.log('Fetched monthly activity data:', monthlyData);
        setData(monthlyData);
      } catch (err) {
        console.error('Error fetching monthly activity data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);
  // Calculate the maximum total for scaling (excluding together and sex)
  const maxTotalActivities = Math.max(
    ...data.map((d) => {
      const filteredCount = Object.entries(d.activities)
        .filter(([activityType, data]) => data.count > 0 && activityType !== 'together' && activityType !== 'sex')
        .reduce((sum, [_, activityData]) => sum + activityData.count, 0);
      return filteredCount;
    }),
    1
  );

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
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.entries(ACTIVITY_COLORS).map(([activityType, color]) => (
            <Chip
              key={activityType}
              label={ACTIVITY_LABELS[activityType]}
              size="small"
              sx={{
                backgroundColor: color,
                color: 'white',
                '& .MuiChip-label': {
                  fontSize: '0.75rem'
                }
              }}
            />
          ))}
        </Box>
        <Box
          sx={{
            position: 'relative',
            height: height - 120,
            mt: 2,
            border: '1px solid #ddd',
            mb: 4,
            pt: 3
          }}
        >
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
            {[
              maxTotalActivities,
              Math.round(maxTotalActivities * 0.75),
              Math.round(maxTotalActivities * 0.5),
              Math.round(maxTotalActivities * 0.25),
              0
            ].map((value, index) => (
              <Typography key={index} variant="caption" color="text.secondary">
                {value}
              </Typography>
            ))}
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
              position: 'relative',
              minWidth: { xs: 'unset', sm: 'unset' },
              width: { xs: 'auto', sm: 'auto' },
              overflowX: { xs: 'visible', sm: 'visible' },
              WebkitOverflowScrolling: 'touch',
              transition: 'width 0.2s'
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
            ))}
            {/* Stacked Bars */}{' '}
            {data.map((item) => {
              const monthIndex = parseInt(item.month) - 1;
              const monthName = MONTHS[monthIndex] || `M${item.month}`;

              // Calculate segment heights for stacked bars (filter out together and sex)
              const activityEntries = Object.entries(item.activities)
                .filter(
                  ([activityType, data]) => data.count > 0 && activityType !== 'together' && activityType !== 'sex'
                )
                .sort((a, b) => b[1].count - a[1].count); // Sort by count descending

              // Calculate total activities excluding together and sex
              const filteredTotalActivities = activityEntries.reduce((sum, [_, data]) => sum + data.count, 0);
              const filteredBarHeight = (filteredTotalActivities / maxTotalActivities) * 100;

              return (
                <Box
                  key={`${item.year}-${item.month}`}
                  sx={{
                    flex: 1,
                    maxWidth: { xs: 20, sm: 60 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    zIndex: 2,
                    height: '100%',
                    position: 'relative',
                    mx: { xs: 0, sm: 0.5 }
                  }}
                >
                  {/* Total count on top */}
                  {filteredTotalActivities > 0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        top: -20,
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        color: '#1976d2',
                        textAlign: 'center',
                        width: '100%'
                      }}
                    >
                      {filteredTotalActivities}
                    </Typography>
                  )}{' '}
                  {/* Stacked segments */}
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: { xs: 20, sm: 60 },
                      height: `${Math.max(filteredBarHeight, filteredTotalActivities > 0 ? 2 : 0)}%`,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column-reverse' // Stack from bottom up
                    }}
                  >
                    {activityEntries.map(([activityType, activityData]) => {
                      const segmentHeight = (activityData.count / filteredTotalActivities) * 100;

                      return (
                        <Tooltip
                          key={activityType}
                          title={`${ACTIVITY_LABELS[activityType]}: ${activityData.count} activities (${activityData.hours}h)`}
                          arrow
                        >
                          <Box
                            sx={{
                              width: '100%',
                              height: `${segmentHeight}%`,
                              backgroundColor: ACTIVITY_COLORS[activityType] || '#718096',
                              border: '1px solid #fff',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              '&:hover': {
                                opacity: 0.8,
                                transform: 'scaleX(1.1)'
                              },
                              ...(activityType === activityEntries[0][0] && {
                                borderRadius: '4px 4px 0 0'
                              })
                            }}
                          >
                            {' '}
                            {/* Activity count in the middle of segment - show if count >= 2 or if segment is tall enough */}
                            {(activityData.count >= 2 || (segmentHeight > 12 && filteredBarHeight > 20)) &&
                              activityData.count > 0 && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    color: 'white',
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                    textAlign: 'center',
                                    lineHeight: 1,
                                    userSelect: 'none'
                                  }}
                                >
                                  {activityData.count}
                                </Typography>
                              )}
                          </Box>
                        </Tooltip>
                      );
                    })}
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
        </Box>{' '}
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
            <Typography variant="h6" color="primary">
              {data.reduce((sum, item) => {
                const filteredCount = Object.entries(item.activities)
                  .filter(
                    ([activityType, data]) => data.count > 0 && activityType !== 'together' && activityType !== 'sex'
                  )
                  .reduce((actSum, [_, activityData]) => actSum + activityData.count, 0);
                return sum + filteredCount;
              }, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Activities
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {Math.round(
                data.reduce((sum, item) => {
                  const filteredCount = Object.entries(item.activities)
                    .filter(
                      ([activityType, data]) => data.count > 0 && activityType !== 'together' && activityType !== 'sex'
                    )
                    .reduce((actSum, [_, activityData]) => actSum + activityData.count, 0);
                  return sum + filteredCount;
                }, 0) / data.length || 0
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg per Month
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {maxTotalActivities}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Peak Month
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ActivityStackedBarChart;
