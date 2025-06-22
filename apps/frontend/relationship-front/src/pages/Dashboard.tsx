import React from 'react';
import { Box, Card, CardContent, Typography, Paper } from '@mui/material';
import { AccessTime, Favorite, CalendarToday, Timeline } from '@mui/icons-material';
import TimeTracker from '../components/TimeTracker';

const Dashboard: React.FC = () => {
  // Mock data for demonstration
  const relationshipStats = {
    totalHours: 245,
    thisWeekHours: 28,
    activitiesCount: 156,
    daysTogether: 89,
    favoriteActivity: 'Cooking'
  };

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
    </Card>
  );
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Relationship Dashboard
      </Typography>
      
      {/* Time Tracker */}
      <TimeTracker />
      
      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<AccessTime />}
            title="Total Hours Together"
            value={`${relationshipStats.totalHours}h`}
            subtitle="Quality time spent"
            color="primary.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<CalendarToday />}
            title="This Week"
            value={`${relationshipStats.thisWeekHours}h`}
            subtitle="Time together this week"
            color="success.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Favorite />}
            title="Activities Done"
            value={relationshipStats.activitiesCount}
            subtitle="Shared experiences"
            color="error.main"
          />
        </Box>
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <StatCard
            icon={<Timeline />}
            title="Days Together"
            value={relationshipStats.daysTogether}
            subtitle="Since tracking started"
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
