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
  useTheme
} from '@mui/material';
import { AccessTime, Favorite, Timeline, Event } from '@mui/icons-material';
import { useStatistics } from '../hooks/useStatistics';
import { useTenantFilter } from '../components/tenant';
import StatCard from './StatCard';

interface StatsCardsProps {
  /** activity types to feature with their own stat card (days it happened) */
  highlightTypeIds: string[];
}

const StatsCards: React.FC<StatsCardsProps> = ({ highlightTypeIds }) => {
  const theme = useTheme();
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
  const handleTimeframeChange = (event: any) => {
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

  const firstEntryLabel = statistics.firstEntryDate
    ? new Date(`${statistics.firstEntryDate}T00:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  const cardCount = 3 + highlightedTypes.length;

  return (
    <Box>
      {/* Header with Title and Timeframe Selector */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2
        }}
      >
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          Relationship Statistics
        </Typography>
        <FormControl sx={{ minWidth: { xs: 120, sm: 200 }, width: { xs: '100%', sm: 'auto' } }} size="small">
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
      {/* Stats Cards Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: `repeat(${Math.min(cardCount, 4)}, 1fr)`
          },
          gap: 3
        }}
      >
        <Box>
          <StatCard
            icon={<Timeline />}
            title="Days"
            value={statistics.daysSinceFirstEntry}
            subtitle={firstEntryLabel ? `days since ${firstEntryLabel}` : 'no entries yet'}
            color={theme.palette.warning.main}
          />
        </Box>
        <Box>
          <StatCard
            icon={<AccessTime />}
            title="Total Hours"
            value={statistics.totalHours}
            subtitle={`${statistics.totalHours} hours for ${getTimeframeLabel()}`}
            color={theme.palette.primary.main}
          />
        </Box>
        {highlightedTypes.map((type) => (
          <Box key={type.typeId}>
            <StatCard
              icon={<Favorite />}
              title={`${type.name} Days`}
              value={type.uniqueDays}
              subtitle={`days with ${type.name.toLowerCase()} for ${getTimeframeLabel()}`}
              color={type.color || theme.palette.error.main}
            />
          </Box>
        ))}
        <Box>
          <StatCard
            icon={<Event />}
            title="Total Activities"
            value={statistics.totalActivities}
            subtitle={`${statistics.totalActivities} activities for ${getTimeframeLabel()}`}
            color={theme.palette.success.main}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default StatsCards;
