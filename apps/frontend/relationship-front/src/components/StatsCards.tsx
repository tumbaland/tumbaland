import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import { AccessTime, Favorite, Timeline, Event } from '@mui/icons-material';
import { useStatistics } from '../hooks/useStatistics';
import { useTenantFilter, useActivePalette } from '@tumbaland/frontend-core';
import StatCard from './StatCard';

interface StatsCardsProps {
  /** activity types to feature with their own stat card (days it happened) */
  highlightTypeIds: string[];
  /**
   * YYYY-MM-DD the "Days" card counts from. Absent falls back to the first
   * logged entry, which is rarely the day things actually started.
   */
  startDate?: string | null;
}

const StatsCards: React.FC<StatsCardsProps> = ({ highlightTypeIds, startDate }) => {
  const palette = useActivePalette();
  const [timeframe, setTimeframe] = useState<string>('all');

  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  const { statistics, loading, error } = useStatistics({
    timeframe,
    groupId: tenantGroupId
  });

  const timeframeOptions = [
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' }
  ];
  const handleTimeframeChange = (event: SelectChangeEvent<string>) => {
    setTimeframe(event.target.value);
  };

  const getTimeframeLabel = () => {
    const option = timeframeOptions.find((opt) => opt.value === timeframe);
    return option ? option.label.toLowerCase() : 'all time';
  };
  if (loading) {
    return (
      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px'
            }}
          >
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Alert severity="error">Error loading statistics: {error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return (
      <Box>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          No statistics available. Please check if the backend is running.
        </Alert>
      </Box>
    );
  }

  // one card per highlighted type: on how many days did it happen?
  const highlightedTypes = highlightTypeIds
    .map((typeId) => statistics.types.find((t) => t.typeId === typeId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  // A configured start date wins over the first entry: the count is meant to be
  // "how long we have been together", not "how long we have been logging".
  const countFrom = startDate || statistics.firstEntryDate;
  const daysSince = startDate
    ? Math.max(0, Math.floor((Date.now() - Date.parse(`${startDate}T00:00:00`)) / 86400000))
    : statistics.daysSinceFirstEntry;

  const countFromLabel = countFrom
    ? new Date(`${countFrom}T00:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  const cardCount = 3 + highlightedTypes.length;

  return (
    <Box>
      {/* Title and timeframe on one row; the selector used to span the width
          of a phone on a line of its own. */}
      <Box
        sx={{
          mb: { xs: 1.5, sm: 3 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5
        }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontWeight: 'bold', color: 'text.primary', fontSize: { xs: '1.1rem', sm: '1.5rem' } }}
        >
          Statistics
        </Typography>
        <FormControl sx={{ width: { xs: 140, sm: 200 }, flexShrink: 0 }} size="small">
          <InputLabel id="timeframe-select-label">Timeframe</InputLabel>
          <Select
            labelId="timeframe-select-label"
            id="timeframe-select"
            value={timeframe}
            label="Timeframe"
            onChange={handleTimeframeChange}
            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
          >
            {timeframeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {/* Two per row on a phone: one per row made four figures fill a screen. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: `repeat(${Math.min(cardCount, 4)}, minmax(0, 1fr))`
          },
          gap: { xs: 1.5, sm: 3 }
        }}
      >
        <Box>
          <StatCard
            icon={<Timeline />}
            title="Days"
            value={daysSince}
            subtitle={countFromLabel ? `days since ${countFromLabel}` : 'no entries yet'}
            color={palette.warning.main}
          />
        </Box>
        <Box>
          <StatCard
            icon={<AccessTime />}
            title="Total Hours"
            value={statistics.totalHours}
            subtitle={`${statistics.totalHours} hours for ${getTimeframeLabel()}`}
            color={palette.primary.main}
          />
        </Box>
        {highlightedTypes.map((type) => (
          <Box key={type.typeId}>
            <StatCard
              icon={<Favorite />}
              title={`${type.name} Days`}
              value={type.uniqueDays}
              subtitle={`days with ${type.name.toLowerCase()} for ${getTimeframeLabel()}`}
              color={type.color || palette.error.main}
            />
          </Box>
        ))}
        <Box>
          <StatCard
            icon={<Event />}
            title="Total Activities"
            value={statistics.totalActivities}
            subtitle={`${statistics.totalActivities} activities for ${getTimeframeLabel()}`}
            color={palette.success.main}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default StatsCards;
