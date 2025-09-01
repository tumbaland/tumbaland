import React, { useState } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Typography,
  Card,
  CardContent
} from '@mui/material';
import { AccessTime, Favorite, Timeline, Event } from '@mui/icons-material';
import { useStatistics } from '../hooks/useStatistics';
import { useTenantFilter } from '../components/tenant';
import StatCard from './StatCard';

const StatsCards: React.FC = () => {
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
      <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 3 }}>
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
      <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 3 }}>
        <CardContent>
          <Alert severity="error">Error loading statistics: {error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return (
      <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 3 }}>
        <CardContent>
          <Alert severity="warning">No statistics available. Please check if the backend is running.</Alert>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 3 }}>
      <CardContent sx={{ p: 3 }}>
        {/* Header with Title and Timeframe Selector */}
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider'
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
              md: 'repeat(4, 1fr)'
            },
            gap: { xs: 2, sm: 3 },
            p: { xs: 0, sm: 2 },
            backgroundColor: { xs: 'transparent', sm: 'grey.50' },
            borderRadius: { xs: 0, sm: 1 }
          }}
        >
          <Box>
            <StatCard
              icon={<Timeline />}
              title="Days"
              value={statistics.daysTogether}
              subtitle={`${statistics.daysTogether} days since Jan 25, 2024`}
              color="warning.main"
            />
          </Box>
          <Box>
            <StatCard
              icon={<AccessTime />}
              title="Total Hours"
              value={statistics.totalHoursTogether}
              subtitle={`${statistics.totalHoursTogether} hours for ${getTimeframeLabel()}`}
              color="primary.main"
            />
          </Box>
          <Box>
            <StatCard
              icon={<Favorite />}
              title="Love Days"
              value={statistics.sexActivityDays}
              subtitle={`${statistics.sexActivityDays} love days for ${getTimeframeLabel()}`}
              color="error.main"
            />
          </Box>
          <Box>
            <StatCard
              icon={<Event />}
              title="Total Activities"
              value={statistics.totalActivities}
              subtitle={`${statistics.totalActivities} activities for ${getTimeframeLabel()}`}
              color="error.main"
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatsCards;
