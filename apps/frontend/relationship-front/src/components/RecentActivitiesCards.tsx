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
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { getRecentActivitiesSummary } from '../api/activities';
import { Activity, ActivityType } from '../api/types';

interface TimelineOption {
  label: string;
  months: number;
}

const timelineOptions: TimelineOption[] = [
  { label: 'Last Month', months: 1 },
  { label: 'Last 3 Months', months: 3 },
  { label: 'Last Year', months: 12 },
];

const categoryConfig: Record<ActivityType, { label: string; color: string }> = {
  movies: { label: 'Movies', color: '#e91e63' },
  cooking: { label: 'Cooking', color: '#ff9800' },
  dining: { label: 'Dining', color: '#4caf50' },
  coffee: { label: 'Coffee', color: '#795548' },
  gaming: { label: 'Gaming', color: '#9c27b0' },
  other: { label: 'Other', color: '#607d8b' },
  sex: { label: 'Sex', color: '#f44336' },
  together: { label: 'Together', color: '#2196f3' },
};

const RecentActivitiesCards: React.FC = () => {
  const [activitiesData, setActivitiesData] = useState<Record<string, Activity[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<number>(1); // Default to "Last Month"
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const categories: ActivityType[] = ['movies', 'cooking', 'dining', 'coffee', 'gaming', 'other'];

  const handleTimelineChange = (event: SelectChangeEvent<number>) => {
    setSelectedTimeline(event.target.value as number);
  };

  const toggleCardExpansion = (category: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const fetchActivitiesData = async () => {
      try {
        setLoading(true);
        const summaryData = await getRecentActivitiesSummary();
        
        const dataMap: Record<string, Activity[]> = {};
        
        // Transform the summary data to match our expected format
        categories.forEach(category => {
          if (summaryData[category]) {
            timelineOptions.forEach(timeline => {
              const key = `${category}-${timeline.months}`;
              const timelineKey = `${timeline.months}months`;
              dataMap[key] = summaryData[category][timelineKey]?.activities || [];
            });
          }
        });

        setActivitiesData(dataMap);
      } catch (err) {
        setError('Failed to fetch activities data');
        console.error('Error fetching activities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivitiesData();
  }, []);

  const formatDate = (date: Date | string): string => {
    const dateObj = new Date(date);
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }
  return (
    <Box sx={{ mb: 4 }}>
      <Typography 
        variant="h5" 
        gutterBottom 
        sx={{ 
          mb: 3, 
          fontWeight: 600,
          fontSize: { xs: '1.25rem', sm: '1.5rem' }
        }}
      >
        Recent Activities by Category
      </Typography>
      
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: { xs: 1, sm: 1.5 }, // Reduced from xs: 1.5, sm: 2
        }}
      >
        {categories.map((category) => (
          <Card 
            key={category}
            sx={{ 
              height: '100%',
              border: `2px solid ${categoryConfig[category].color}`,
              borderRadius: 2,
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-2px)',
                transition: 'all 0.2s ease-in-out',
              },
            }}
          >
            <CardContent sx={{ p: { xs: 1.25, sm: 1.5 } }}> {/* Reduced from xs: 1.5, sm: 2 */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}> {/* Reduced from mb={2} */}
                <Chip
                  label={categoryConfig[category].label}
                  sx={{
                    backgroundColor: categoryConfig[category].color,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    height: { xs: 24, sm: 28 },
                  }}
                />
                <Box display="flex" alignItems="center" gap={0.5}>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <Select
                      value={selectedTimeline}
                      onChange={handleTimelineChange}
                      sx={{
                        fontSize: { xs: '0.65rem', sm: '0.7rem' },
                        height: { xs: 28, sm: 32 },
                        '& .MuiSelect-select': {
                          py: { xs: 0.5, sm: 0.75 },
                        },
                      }}
                    >
                      {timelineOptions.map((timeline) => (
                        <MenuItem 
                          key={timeline.months} 
                          value={timeline.months}
                          sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
                        >
                          {timeline.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {(() => {
                    const key = `${category}-${selectedTimeline}`;
                    const activities = activitiesData[key] || [];
                    return activities.length > 0 ? (
                      <Tooltip title={expandedCards.has(category) ? 'Show less' : 'Show all'}>
                        <IconButton
                          size="small"
                          onClick={() => toggleCardExpansion(category)}
                          sx={{
                            p: 0.5,
                            '& .MuiSvgIcon-root': {
                              fontSize: { xs: '1rem', sm: '1.2rem' },
                            },
                          }}
                        >
                          {expandedCards.has(category) ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Tooltip>
                    ) : null;
                  })()}
                </Box>
              </Box>

              {(() => {
                const key = `${category}-${selectedTimeline}`;
                const activities = activitiesData[key] || [];

                return (
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
                          maxHeight: expandedCards.has(category) ? 'none' : { xs: 200, sm: 250 },
                          overflowY: expandedCards.has(category) ? 'visible' : 'auto',
                          pr: expandedCards.has(category) ? 0 : 0.5,
                          '&::-webkit-scrollbar': {
                            width: '4px',
                            display: expandedCards.has(category) ? 'none' : 'block',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: '#f1f1f1',
                            borderRadius: '4px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: '#888',
                            borderRadius: '4px',
                          },
                          '&::-webkit-scrollbar-thumb:hover': {
                            background: '#555',
                          },
                        }}
                      >
                        {activities.map((activity, index) => (
                          <Box 
                            key={activity._id || activity.id || index}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'flex-start',
                              mb: 0.25, // Reduced from 0.75
                              pb: 0.25, // Reduced from 0.5
                              borderBottom: index < activities.length - 1 ? '1px solid' : 'none',
                              borderBottomColor: 'divider',
                            }}
                          >
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: { xs: '0.6rem', sm: '0.65rem' },
                                color: 'text.secondary',
                                fontWeight: 600,
                                minWidth: 'fit-content',
                                mr: 0.75, // Reduced from 1
                                lineHeight: 1.2, // Added for more compact text
                              }}
                            >
                              {formatDate(activity.date)}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                lineHeight: 1.2, // Reduced from 1.3
                                color: 'text.primary',
                                flex: 1,
                                wordBreak: 'break-word',
                              }}
                            >
                              {activity.activity.description || 'No description'}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default RecentActivitiesCards;
