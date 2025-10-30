import React from 'react';
import { Box } from '@mui/material';
import StatsCards from '../components/StatsCards';
import RecentActivitiesCards from '../components/RecentActivitiesCards';
import HoursBarChart from '../components/HoursBarChart';
import TotalHoursChart from '../components/TotalHoursChart';
import TotalDaysChart from '../components/TotalDaysChart';
import WeeklyHeatmap from '../components/WeeklyHeatmap';
import CumulativeTimeline from '../components/CumulativeTimeline';

const Dashboard: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <StatsCards />
      <RecentActivitiesCards />
      <Box sx={{ mb: 4, width: '100%' }}>
        <HoursBarChart />
      </Box>
      <Box sx={{ mb: 4, width: '100%' }}>
        <TotalHoursChart />
      </Box>
      <Box sx={{ mb: 4, width: '100%' }}>
        <TotalDaysChart />
      </Box>
      <Box sx={{ mb: 4, width: '100%' }}>
        <CumulativeTimeline height={400} />
      </Box>
      <Box sx={{ mb: 4, width: '100%', display: { xs: 'none', sm: 'block' } }}>
        <WeeklyHeatmap />
      </Box>
    </Box>
  );
};

export default Dashboard;
