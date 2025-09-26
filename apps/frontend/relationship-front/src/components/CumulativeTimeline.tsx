import React, { useEffect, useState, useRef } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Chip
} from '@mui/material';
import { getCumulativeTimelineData, CumulativeTimelineData } from '../api/statistics';
import { getActivityTypes } from '../api/activityTypes';
import { ActivityType } from '../api/types';
import { useTenantFilter } from './tenant';

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
  const [viewMode, setViewMode] = useState<'activities' | 'hours'>('activities');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [containerWidth, setContainerWidth] = useState<number>(800); // Start with reasonable default
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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
      console.log('Fetched timeline data:', timelineData);
      console.log('Fetched activity types:', activityTypesResponse);
      setData(timelineData);
      setActivityTypes(activityTypesResponse.data);
      setSelectedLines(activityTypesResponse.data
        .filter(type => type.slug !== 'total')
        .map(type => type.slug));
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth - 32; // Account for padding
        if (newWidth > 0) {
          setContainerWidth(newWidth);
        }
      }
    };

    // Initial width measurement
    updateWidth();

    // Use ResizeObserver for better responsiveness
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
      resizeObserver.disconnect();
    };
  }, [data]); // Run when data changes to ensure proper measurement

  useEffect(() => {
    fetchData();
  }, [selectedYear, tenantGroupId]); // Calculate chart dimensions and scaling
  const chartHeight = height - 160; // Leave space for controls and stats
  const chartWidth = containerWidth; // Use container width
  const padding = 40;
  const plotHeight = chartHeight - padding * 2;

  // Get cumulative values for each activity type
  const getActivityLineData = (activityType: string) => {
    return data.map((item) => {
      if (activityType === 'total') {
        return viewMode === 'activities' ? item.cumulativeActivities : item.cumulativeHours;
      }
      return item.activityBreakdown[activityType]?.cumulativeCount || 0;
    });
  };

  // Get max values for scaling based on selected lines
  const getMaxValueForSelectedLines = () => {
    if (selectedLines.length === 0) return 1;

    let maxValue = 0;

    selectedLines.forEach((activityType) => {
      const values = getActivityLineData(activityType);
      const lineMax = Math.max(...values);
      maxValue = Math.max(maxValue, lineMax);
    });

    return Math.max(maxValue, 1); // Ensure minimum of 1
  };

  const maxValue = getMaxValueForSelectedLines();
  // Create SVG path for a line
  const createPath = (values: number[]) => {
    if (values.length === 0) return '';

    const svgWidth = Math.max(chartWidth, 600);
    const svgPlotWidth = svgWidth - padding * 2;

    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * svgPlotWidth;
      const y = padding + plotHeight - (value / maxValue) * plotHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Toggle line visibility
  const toggleLine = (activityType: string) => {
    setSelectedLines((prev) =>
      prev.includes(activityType) ? prev.filter((type) => type !== activityType) : [...prev, activityType]
    );
  };
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
        {/* Header Controls */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
          <Typography variant="h6">{title}</Typography>

          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="activities">Activities</ToggleButton>
              <ToggleButton value="hours">Hours</ToggleButton>
            </ToggleButtonGroup>

            {/* Year Selector */}
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
        </Box>
        {/* Line Toggle Chips */}
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {activityTypes
            .map((activityType) => (
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
          ))}
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
        {/* Chart Container */}
        <Box sx={{ width: '100%', pb: 2 }} ref={containerRef}>
          <Box sx={{ width: '100%' }}>
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${Math.max(chartWidth, 600)} ${chartHeight}`}
              style={{ border: '1px solid #e0e0e0' }}
            >
              {' '}
              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map((ratio, index) => {
                const svgWidth = Math.max(chartWidth, 600);
                const svgPlotWidth = svgWidth - padding * 2;

                return (
                  <g key={index}>
                    <line
                      x1={padding}
                      y1={padding + plotHeight * (1 - ratio)}
                      x2={padding + svgPlotWidth}
                      y2={padding + plotHeight * (1 - ratio)}
                      stroke="#f0f0f0"
                      strokeWidth="1"
                    />
                    <text
                      x={padding - 5}
                      y={padding + plotHeight * (1 - ratio) + 4}
                      fontSize="10"
                      fill="#666"
                      textAnchor="end"
                    >
                      {Math.round(maxValue * ratio)}
                    </text>
                  </g>
                );
              })}
              {/* Y-axis */}
              <line
                x1={padding}
                y1={padding}
                x2={padding}
                y2={padding + plotHeight}
                stroke="#e0e0e0"
                strokeWidth="2"
              />{' '}
              {/* X-axis */}
              <line
                x1={padding}
                y1={padding + plotHeight}
                x2={padding + Math.max(chartWidth, 600) - padding * 2}
                y2={padding + plotHeight}
                stroke="#e0e0e0"
                strokeWidth="2"
              />
              {/* Activity Lines */}
              {selectedLines.map((activityType) => {
                const values = getActivityLineData(activityType);
                const path = createPath(values);
                const activityTypeData = activityTypes.find(type => type.slug === activityType);
                const color = activityType === 'total' ? '#1976d2' : (activityTypeData?.color || '#9e9e9e');

                return (
                  <path
                    key={activityType}
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}{' '}
              {/* Data points */}
              {selectedLines.map((activityType) => {
                const values = getActivityLineData(activityType);
                const activityTypeData = activityTypes.find(type => type.slug === activityType);
                const color = activityType === 'total' ? '#1976d2' : (activityTypeData?.color || '#9e9e9e');
                const svgWidth = Math.max(chartWidth, 600);
                const svgPlotWidth = svgWidth - padding * 2;

                return values.map((value, index) => {
                  const x = padding + (index / (values.length - 1)) * svgPlotWidth;
                  const y = padding + plotHeight - (value / maxValue) * plotHeight;

                  return (
                    <circle
                      key={`${activityType}-${index}`}
                      cx={x}
                      cy={y}
                      r="3"
                      fill={color}
                      stroke="white"
                      strokeWidth="1"
                    >
                      <title>
                        {`${data[index].date}: ${value} ${viewMode === 'activities' ? 'activities' : 'hours'}`}
                      </title>
                    </circle>
                  );
                });
              })}{' '}
              {/* Date labels (show every nth date to avoid overcrowding) */}
              {data
                .filter((_, index) => index % Math.ceil(data.length / 10) === 0)
                .map((item, index) => {
                  const originalIndex = index * Math.ceil(data.length / 10);
                  const svgWidth = Math.max(chartWidth, 600);
                  const svgPlotWidth = svgWidth - padding * 2;
                  const x = padding + (originalIndex / (data.length - 1)) * svgPlotWidth;

                  return (
                    <text
                      key={item.date}
                      x={x}
                      y={padding + plotHeight + 15}
                      fontSize="10"
                      fill="#666"
                      textAnchor="middle"
                      transform={`rotate(-45, ${x}, ${padding + plotHeight + 15})`}
                    >
                      {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </text>
                  );
                })}
            </svg>
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
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.length > 0 ? data[data.length - 1].cumulativeActivities : 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Activities
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.length > 0 ? Math.round(data[data.length - 1].cumulativeHours) : 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Hours
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active Days
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="h6" color="primary">
              {data.length > 0
                ? Math.round(data.reduce((sum, item) => sum + item.dailyActivities, 0) / data.length)
                : 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg Per Day
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CumulativeTimeline;
