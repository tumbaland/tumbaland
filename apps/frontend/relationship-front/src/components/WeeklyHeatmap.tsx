import React, { useEffect, useState } from 'react';
import { useTenantFilter } from '@tumbaland/components';
import { logger } from '@tumbaland/frontend-core';
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
  InputLabel
} from '@mui/material';
import { getWeeklyHeatmapData, WeeklyHeatmapData } from '../api/statistics';

interface WeeklyHeatmapProps {
  title?: string;
  year?: number;
  height?: number;
  /** activity type slugs excluded from the counts (user's dashboard config) */
  hiddenSlugs?: Set<string>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color intensity levels based on activity count
const getActivityColor = (count: number, maxCount: number): string => {
  if (count === 0) return '#ebedf0';

  const intensity = count / maxCount;
  if (intensity <= 0.2) return '#c6e48b';
  if (intensity <= 0.4) return '#7bc96f';
  if (intensity <= 0.6) return '#239a3b';
  if (intensity <= 0.8) return '#196127';
  return '#0d4820';
};

const WeeklyHeatmap: React.FC<WeeklyHeatmapProps> = ({
  title = 'Activity Heatmap',
  year,
  height = 200,
  hiddenSlugs
}) => {
  const [data, setData] = useState<WeeklyHeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);

  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  // Generate available years (from 2024 to current year)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const heatmapData = await getWeeklyHeatmapData(selectedYear, tenantGroupId);
      logger.debug('Fetched heatmap data', { count: heatmapData.length });
      setData(heatmapData);
    } catch (err) {
      logger.error('Error fetching heatmap data', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, tenantGroupId]);

  // Count for a day, excluding types the user hid from charts
  const effectiveCount = (d: WeeklyHeatmapData): number => {
    if (!hiddenSlugs || hiddenSlugs.size === 0) return d.totalActivities;
    return Object.entries(d.activities).reduce(
      (sum, [slug, info]) => (hiddenSlugs.has(slug) ? sum : sum + info.count),
      0
    );
  };

  // Calculate max activity count for color scaling
  const maxActivityCount = Math.max(...data.map(effectiveCount), 1);

  // Create a map for quick lookup of data by date
  const dataMap = new Map<string, WeeklyHeatmapData>();
  data.forEach((item) => {
    dataMap.set(item.date, item);
  });

  // Generate calendar grid
  const generateCalendarGrid = () => {
    if (data.length === 0) return [];

    const yearToShow = selectedYear || currentYear;
    const startDate = new Date(yearToShow, 0, 1);
    const endDate = new Date(yearToShow, 11, 31);

    // Find the Sunday of the week containing January 1st
    const firstSunday = new Date(startDate);
    firstSunday.setDate(startDate.getDate() - startDate.getDay());

    // Generate weeks
    const weeks = [];
    const currentDate = new Date(firstSunday);

    while (currentDate <= endDate || weeks.length < 53) {
      const week = [];

      for (let day = 0; day < 7; day++) {
        // Parse date string as local date to avoid timezone issues
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayOfMonth}`;
        const dayData = dataMap.get(dateStr);
        const isCurrentYear = currentDate.getFullYear() === yearToShow;

        week.push({
          date: dateStr,
          data: dayData,
          isCurrentYear,
          dayOfWeek: day,
          displayDate: new Date(year, currentDate.getMonth(), currentDate.getDate())
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(week);

      // Break if we've gone too far past the end of the year
      if (currentDate > endDate && currentDate.getMonth() > 0) {
        break;
      }
    }

    return weeks;
  };

  if (loading) {
    return (
      <Card
        elevation={0}
        sx={{
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <CardContent sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 2 } }}>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  const weeks = generateCalendarGrid();

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <CardContent
        sx={{
          p: { xs: 1, sm: 2 },
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 2
          }}
        >
          <Typography variant="h6" sx={{ mb: { xs: 1, sm: 0 } }}>
            {title}
          </Typography>
          <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 120 }, width: { xs: '100%', sm: 'auto' } }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear || currentYear}
              label="Year"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((yearOption) => (
                <MenuItem key={yearOption} value={yearOption}>
                  {yearOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {/* Heatmap Grid */}
        <Box
          sx={{
            overflowX: 'auto',
            pb: 2,
            display: 'flex',
            width: '100%'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              minWidth: { xs: 'unset', sm: 800 },
              width: { xs: '100%', sm: 'auto' },
              maxWidth: { xs: '100%', sm: 900 },
              mx: { xs: 0, sm: 'auto' }
            }}
          >
            {/* Day labels */}
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                gap: 1,
                pt: 4
              }}
            >
              {DAYS.map((day, index) => (
                <Box
                  key={day}
                  sx={{
                    height: 12,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: index % 2 === 0 ? 1 : 0
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', width: 25 }}>
                    {index % 2 === 0 ? day : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
            {/* Calendar Grid */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Month labels */}
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, mb: 1, height: 20, gap: 1 }}>
                {weeks.map((week, weekIndex) => {
                  const firstDayOfWeek = week[0].displayDate;
                  const showMonth = firstDayOfWeek.getDate() <= 7 || weekIndex === 0;

                  return (
                    <Box
                      key={weekIndex}
                      sx={{
                        width: 12,
                        display: 'flex',
                        justifyContent: 'center'
                      }}
                    >
                      {showMonth && (
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {MONTHS[firstDayOfWeek.getMonth()]}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Heatmap cells */}
              <Box sx={{ display: 'flex', gap: { xs: 0.15, sm: 0.7 } }}>
                {weeks.map((week, weekIndex) => (
                  <Box
                    key={weekIndex}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: { xs: 0.15, sm: 0.7 },
                      width: { xs: 3.5, sm: 10 }
                    }}
                  >
                    {week.map((day, dayIndex) => {
                      const activityCount = day.data ? effectiveCount(day.data) : 0;
                      const color = day.isCurrentYear ? getActivityColor(activityCount, maxActivityCount) : '#ebedf0';

                      const tooltipTitle = day.data
                        ? `${day.displayDate.toLocaleDateString()}: ${activityCount} activities (${day.data.totalHours}h)`
                        : `${day.displayDate.toLocaleDateString()}: No activities`;

                      return (
                        <Tooltip key={dayIndex} title={tooltipTitle} arrow>
                          <Box
                            sx={{
                              width: { xs: 3.5, sm: 10 },
                              height: { xs: 3.5, sm: 10 },
                              backgroundColor: color,
                              border: '1px solid #e1e4e8',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                transform: 'scale(1.2)',
                                borderColor: '#333'
                              }
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
        {/* Legend */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            mt: 2,
            pt: 2,
            borderTop: '1px solid #e0e0e0'
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              mb: { xs: 1, sm: 0 }
            }}>
            {data.length} days with activities
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Less
            </Typography>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, index) => (
              <Box
                key={index}
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: getActivityColor(intensity * maxActivityCount, maxActivityCount),
                  border: '1px solid #e1e4e8',
                  borderRadius: '2px'
                }}
              />
            ))}
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              More
            </Typography>
          </Box>
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
            gap: 2
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {data.reduce((sum, item) => sum + effectiveCount(item), 0)}
            </Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Total Activities
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {data.filter((item) => effectiveCount(item) > 0).length}
            </Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Active Days
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {maxActivityCount}
            </Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              Max Per Day
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WeeklyHeatmap;
