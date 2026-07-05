import React, { useEffect, useState } from 'react';
import { logger } from '@tumbaland/components';
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
import { LineChart } from '@mui/x-charts';
import { getCumulativeTimelineData, CumulativeTimelineData } from '../api/statistics';
import { getActivityTypes } from '../api/activityTypes';
import { ActivityType } from '../api/types';
import { useTenantFilter } from './tenant';
interface ProcessedCumulativeTimelineData extends CumulativeTimelineData {
  cumulativeByType?: {
    activityTypeSlug: string;
    cumulativeActivities: number;
    cumulativeHours: number;
  }[];
}

interface CumulativeTimelineProps {
  title?: string;
  year?: number;
  height?: number;
}

const CumulativeTimeline: React.FC<CumulativeTimelineProps> = ({
  title = 'Cumulative Activity Timeline',
  year,
  height = 400
}) => {
  const [data, setData] = useState<CumulativeTimelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(year);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
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
      const [timelineData, activityTypesResponse] = await Promise.all([
        getCumulativeTimelineData(selectedYear, tenantGroupId),
        getActivityTypes({ groupId: tenantGroupId })
      ]);
      logger.debug('Fetched cumulative timeline data', { count: timelineData.length });
      logger.debug('Fetched activity types', { count: activityTypesResponse.data.length });
      setData(timelineData);
      setActivityTypes(activityTypesResponse.data);
      setSelectedLines(activityTypesResponse.data
        .filter(type => type.slug !== 'total')
        .map(type => type.slug));
    } catch (err) {
      logger.error('Error fetching cumulative timeline data', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, tenantGroupId]);

  // Calculate cumulative data per activity type
  const processedData: ProcessedCumulativeTimelineData[] = React.useMemo(() => {
    if (!data.length || !activityTypes.length) return data as ProcessedCumulativeTimelineData[];

    const cumulativeMap = new Map<string, number>();

    return data.map(item => {
      const processedItem: ProcessedCumulativeTimelineData = { ...item };

      // Calculate cumulative for each activity type
      activityTypes.forEach(activityType => {
        const slug = activityType.slug;
        const dailyCount = item.activityBreakdown[slug]?.dailyCount || 0;
        const currentCumulative = cumulativeMap.get(slug) || 0;
        const newCumulative = currentCumulative + dailyCount;
        cumulativeMap.set(slug, newCumulative);

        // Add cumulative data to the item
        if (!processedItem.cumulativeByType) {
          processedItem.cumulativeByType = [];
        }
        processedItem.cumulativeByType.push({
          activityTypeSlug: slug,
          cumulativeActivities: newCumulative,
          cumulativeHours: newCumulative * 0.5 // Assuming average 30 minutes per activity, adjust as needed
        });
      });

      return processedItem;
    });
  }, [data, activityTypes]);

  // Toggle line visibility
  const toggleLine = (activityType: string) => {
    setSelectedLines((prev) =>
      prev.includes(activityType) ? prev.filter((type) => type !== activityType) : [...prev, activityType]
    );
  };
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
        {/* Header Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6" sx={{
            fontWeight: "bold"
          }}>{title}</Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Year Selector */}
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
        </Box>
        {/* Line Toggle Chips */}
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {activityTypes
            .map((activityType) => {
              return (
                <Chip
                  key={activityType._id}
                  label={activityType.name}
                  size="small"
                  clickable
                  onClick={() => toggleLine(activityType.slug)}
                  sx={{
                    backgroundColor: selectedLines.includes(activityType.slug) ? (activityType.color || '#9e9e9e') : '#e0e0e0',
                    color: selectedLines.includes(activityType.slug) ? 'white' : '#666',
                    '& .MuiChip-label': {
                      fontSize: '0.75rem'
                    }
                  }}
                />
              );
            })}
          {/* Total line toggle */}
          <Chip
            key="total"
            label="Total"
            size="small"
            clickable
            onClick={() => toggleLine('total')}
            sx={{
              backgroundColor: selectedLines.includes('total') ? '#1976d2' : '#e0e0e0',
              color: selectedLines.includes('total') ? 'white' : '#666',
              '& .MuiChip-label': {
                fontSize: '0.75rem'
              }
            }}
          />
        </Box>{' '}
        <Box sx={{ width: '100%', height: height - 100 }}>
          <LineChart
            xAxis={[{
              data: processedData.map(item => {
                const date = new Date(item.date);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              }),
              scaleType: 'point',
              tickLabelInterval: (_, index) => {
                const totalPoints = processedData.length;
                // Show labels at: start, 25%, 50%, 75%, and end
                const keyIndices = [0, Math.floor(totalPoints * 0.25), Math.floor(totalPoints * 0.5), Math.floor(totalPoints * 0.75), totalPoints - 1];
                return keyIndices.includes(index);
              }
            }]}
            yAxis={[{
              label: isMobile ? undefined : 'Cumulative Activities'
            }]}
            series={selectedLines.map(lineSlug => {
              const activityType = activityTypes.find(type => type.slug === lineSlug);
              if (lineSlug === 'total') {
                return {
                  data: processedData.map(item => item.cumulativeActivities),
                  label: 'Total',
                  color: '#1976d2',
                  showMark: false
                };
              }
              // For activity type specific lines, we need to access the cumulative data for that type
              return {
                data: processedData.map(item => {
                  const typeData = item.cumulativeByType?.find((type: any) => type.activityTypeSlug === lineSlug);
                  return typeData?.cumulativeActivities || 0;
                }),
                label: activityType?.name || lineSlug,
                color: activityType?.color || '#9e9e9e',
                showMark: false
              };
            })}
            height={height - 80}
            margin={{ 
              top: 10, 
              right: 15, 
              bottom: 10, 
              left: isMobile ? 15 : 50 
            }}
            disableAxisListener
          />
        </Box>
        {/* Summary stats */}
        <Box
          sx={{
            mt: isMobile ? 14 : 8,
            display: 'flex',
            justifyContent: 'space-around',
            pt: isMobile ? 1 : 2,
            borderTop: '1px solid #e0e0e0',
            flexWrap: 'wrap',
            gap: isMobile ? 1 : 2
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant={isMobile ? "body1" : "h6"} color="primary" sx={{ fontSize: isMobile ? '1rem' : undefined }}>
              {processedData.length > 0 ? processedData[processedData.length - 1].cumulativeActivities : 0}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: isMobile ? '0.7rem' : undefined
              }}>
              Total Activities
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant={isMobile ? "body1" : "h6"} color="primary" sx={{ fontSize: isMobile ? '1rem' : undefined }}>
              {processedData.length}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: isMobile ? '0.7rem' : undefined
              }}>
              Active Days
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant={isMobile ? "body1" : "h6"} color="primary" sx={{ fontSize: isMobile ? '1rem' : undefined }}>
              {processedData.length > 0
                ? Math.round(processedData.reduce((sum, item) => sum + item.dailyActivities, 0) / processedData.length)
                : 0}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: isMobile ? '0.7rem' : undefined
              }}>
              Avg Per Day
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CumulativeTimeline;
