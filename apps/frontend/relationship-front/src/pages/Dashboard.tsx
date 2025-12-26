import React from 'react';
import { Box, Typography } from '@mui/material';
import StatsCards from '../components/StatsCards';
import RecentActivitiesCards from '../components/RecentActivitiesCards';
import HoursBarChart from '../components/HoursBarChart';
import TotalHoursChart from '../components/TotalHoursChart';
import TotalDaysChart from '../components/TotalDaysChart';
import WeeklyHeatmap from '../components/WeeklyHeatmap';
import CumulativeTimeline from '../components/CumulativeTimeline';

const Dashboard: React.FC = () => {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflowX: 'hidden' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Overview of your relationship activities and statistics
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Key Statistics */}
        <Box sx={{ width: '100%' }}>
          <StatsCards />
        </Box>

        {/* Recent Activities */}
        <Box sx={{ width: '100%' }}>
          <RecentActivitiesCards />
        </Box>

        {/* Charts Section */}
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <HoursBarChart />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <TotalHoursChart />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <TotalDaysChart />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <CumulativeTimeline height={400} />
        </Box>

        {/* Heatmap */}
        <Box sx={{ width: '100%' }}>
          <WeeklyHeatmap />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
