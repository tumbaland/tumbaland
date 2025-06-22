import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Paper, CircularProgress } from '@mui/material';
import { AccessTime, Favorite, Timeline, Event } from '@mui/icons-material';
import { useActivities } from '../hooks/useActivities';

const Dashboard: React.FC = () => {
  const { activities = [], loading, error } = useActivities();

  // Calculate relationship stats from real data
  const relationshipStats = useMemo(() => {
    // Relationship start date
    const startDate = new Date('2024-01-25');
    const today = new Date();
    const daysTogether = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate stats from activities
    const totalHours = activities.reduce((sum, activity) => {
      return sum + (activity.hours || 0);
    }, 0);

    const sexActivities = activities.filter(activity => 
      activity.activity.type === 'sex'
    ).length;

    const activitiesCount = activities.length;

    return {
      totalHours,
      sexActivities,
      activitiesCount,
      daysTogether
    };
  }, [activities]);

  const StatCard = ({ icon, title, value, subtitle, color }: any) => (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Box sx={{ color: color, mr: 1 }}>
            {icon}
          </Box>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="p" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </CardContent>
    </Card>  );

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Relationship Dashboard
        </Typography>
        <Typography color="error">
          Error loading data: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Relationship Dashboard
      </Typography>
      
      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 280, flex: 1 }}>          <StatCard
            icon={<AccessTime />}
            title="Total Hours Together"
            value={relationshipStats.totalHours}
            subtitle={`${relationshipStats.totalHours} hours spent together`}
            color="primary.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>          <StatCard
            icon={<Favorite />}
            title="Sex Activities"
            value={relationshipStats.sexActivities}
            subtitle={`${relationshipStats.sexActivities} intimate moments`}
            color="success.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>          <StatCard
            icon={<Event />}
            title="Activities Done"
            value={relationshipStats.activitiesCount}
            subtitle={`${relationshipStats.activitiesCount} shared experiences`}
            color="error.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>          <StatCard
            icon={<Timeline />}
            title="Days Together"
            value={relationshipStats.daysTogether}
            subtitle={`${relationshipStats.daysTogether} days since Jan 25, 2024`}
            color="info.main"
          />
        </Box>
      </Box>

      {/* Charts Section */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 2, minWidth: 400 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Time Spent Together Over Time
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}
            >
              <Typography>Time tracking chart will be implemented here</Typography>
            </Box>
          </Paper>
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Favorite Activities
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}
            >
              <Typography>Activity distribution chart will be here</Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
