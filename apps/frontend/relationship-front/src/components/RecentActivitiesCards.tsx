import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  IconButton,
  Tooltip,
  InputLabel,
  alpha
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { logger } from '@tumbaland/components';
import { getRecentActivitiesSummary } from '../api/activities';
import { Activity, ActivityType } from '../api/types';
import { useTenantFilter } from './tenant';
import { getActivityTypes } from '../api/activityTypes';

interface TimelineOption {
  label: string;
  months: number;
}

const timelineOptions: TimelineOption[] = [
  { label: 'Last Month', months: 1 },
  { label: 'Last 3 Months', months: 3 },
  { label: 'Last Year', months: 12 }
];

const RecentActivitiesCards: React.FC = () => {
  const [activitiesData, setActivitiesData] = useState<Record<string, Activity[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<number>(1); // Default to "Last Month"
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  // Fetch activity types and activities data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch activity types
        const typesResponse = await getActivityTypes({ groupId: tenantGroupId });
        const types = typesResponse.data;
        setActivityTypes(types);

        // Fetch activities summary
        const summaryResponse = await getRecentActivitiesSummary(tenantGroupId);
        const summaryData = summaryResponse;

        logger.debug('Fetched activity types', { count: types.length });
        logger.debug('Fetched recent activities summary', { keys: Object.keys(summaryData) });

        // Transform data to use activity type slugs as keys
        const dataMap: Record<string, Activity[]> = {};
        types.forEach((type) => {
          const timelineKey = `${selectedTimeline}months`;
          if (summaryData[type.slug] && summaryData[type.slug][timelineKey]) {
            dataMap[type.slug] = summaryData[type.slug][timelineKey].activities || [];
          } else {
            dataMap[type.slug] = [];
          }
        });

        logger.debug('Transformed recent activities data map', { keys: Object.keys(dataMap) });
        setActivitiesData(dataMap);
      } catch (err) {
        logger.error('Failed to fetch recent activities data', err);
        setError('Failed to load activities data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTimeline, tenantGroupId]);

  const handleTimelineChange = (event: SelectChangeEvent<number>) => {
    setSelectedTimeline(event.target.value as number);
  };

  const toggleCardExpansion = (category: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const formatDate = (date: Date | string): string => {
    const dateObj = new Date(date);
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 200
        }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }
  return (
    <Box>
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
        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontWeight: 'bold',
            color: 'text.primary'
          }}
        >
          Recent Activities by Category
        </Typography>
        <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 200 }, width: { xs: '100%', sm: 'auto' } }}>
          <InputLabel id="timeline-select-label">Timeline</InputLabel>
          <Select
            labelId="timeline-select-label"
            value={selectedTimeline}
            onChange={handleTimelineChange}
            label="Timeline"
            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
          >
            {timelineOptions.map((timeline) => (
              <MenuItem key={timeline.months} value={timeline.months}>
                {timeline.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 3
        }}
      >
        {activityTypes.map((activityType) => {
          const activities = activitiesData[activityType.slug] || [];

          return (
            <Card
              key={activityType._id}
              elevation={0}
              sx={{
                height: '100%',
                border: '1px solid',
                borderColor: alpha(activityType.color || '#607d8b', 0.3),
                borderRadius: 3,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 20px ${alpha(activityType.color || '#607d8b', 0.15)}`,
                  borderColor: alpha(activityType.color || '#607d8b', 0.5)
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 2
                  }}>
                  <Chip
                    label={activityType.name}
                    sx={{
                      backgroundColor: alpha(activityType.color || '#607d8b', 0.1),
                      color: activityType.color || '#607d8b',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: alpha(activityType.color || '#607d8b', 0.3)
                    }}
                  />
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center"
                    }}>
                    {activities.length > 0 ? (
                      <Tooltip title={expandedCards.has(activityType.slug) ? 'Show less' : 'Show all'}>
                        <IconButton
                          size="small"
                          onClick={() => toggleCardExpansion(activityType.slug)}
                        >
                          {expandedCards.has(activityType.slug) ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Box>
                </Box>
                <Box>
                  {activities.length === 0 ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.disabled',
                        fontSize: { xs: '0.65rem', sm: '0.7rem' },
                        fontStyle: 'italic',
                        textAlign: 'center',
                        py: 2
                      }}
                    >
                      No activities found
                    </Typography>
                  ) : (
                    <Box
                      sx={{
                        maxHeight: expandedCards.has(activityType.slug) ? 'none' : { xs: 200, sm: 250 },
                        overflowY: expandedCards.has(activityType.slug) ? 'visible' : 'auto',
                        pr: expandedCards.has(activityType.slug) ? 0 : 0.5,
                        '&::-webkit-scrollbar': {
                          width: '4px',
                          display: expandedCards.has(activityType.slug) ? 'none' : 'block'
                        },
                        '&::-webkit-scrollbar-track': {
                          background: '#f1f1f1',
                          borderRadius: '4px'
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: '#888',
                          borderRadius: '4px'
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                          background: '#555'
                        }
                      }}
                    >
                      {activities.map((activity, index) => (
                        <Box
                          key={activity._id || activity.id || index}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            mb: 0.25,
                            pb: 0.25,
                            borderBottom: index < activities.length - 1 ? '1px solid' : 'none',
                            borderBottomColor: 'divider'
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: { xs: '0.6rem', sm: '0.65rem' },
                              color: 'text.secondary',
                              fontWeight: 600,
                              minWidth: 'fit-content',
                              mr: 0.75,
                              lineHeight: 1.2
                            }}
                          >
                            {formatDate(activity.date)}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: { xs: '0.65rem', sm: '0.7rem' },
                              lineHeight: 1.2,
                              color: 'text.primary',
                              flex: 1,
                              wordBreak: 'break-word'
                            }}
                          >
                            {activity.activity.description || 'No description'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default RecentActivitiesCards;
