import React, { useMemo, useState } from 'react';
import { Box, Button, Typography, useMediaQuery, useTheme } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import StatsCards from '../components/StatsCards';
import StreakCards from '../components/StreakCards';
import MilestonesCard from '../components/MilestonesCard';
import TrendsCard from '../components/TrendsCard';
import RecentActivitiesCards from '../components/RecentActivitiesCards';
import HoursBarChart from '../components/HoursBarChart';
import TotalHoursChart from '../components/TotalHoursChart';
import TotalDaysChart from '../components/TotalDaysChart';
import WeeklyHeatmap from '../components/WeeklyHeatmap';
import CumulativeTimeline from '../components/CumulativeTimeline';
import DashboardCustomizeDialog from '../components/DashboardCustomizeDialog';
import { useDashboardSettings } from '../hooks/useDashboardSettings';
import { useTenantFilter } from '@tumbaland/frontend-core';

const Dashboard: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { settings, types, save } = useDashboardSettings(tenantGroupId);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Charts are a full screen width on a phone already; at desktop height each
  // one filled most of the screen on its own.
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const chartHeight = isPhone ? 320 : 400;

  // hidden types by slug, for chart components whose data is keyed by slug
  const hiddenSlugs = useMemo(
    () =>
      new Set(
        settings.hiddenTypeIds
          .map((id) => types.find((t) => t._id === id)?.slug)
          .filter((slug): slug is string => Boolean(slug))
      ),
    [settings.hiddenTypeIds, types]
  );

  const featuredType = useMemo(
    () => types.find((t) => t._id === settings.highlightTypeIds[0]),
    [settings.highlightTypeIds, types]
  );

  return (
    <Box sx={{ px: { xs: 0, sm: 3 }, py: { xs: 1.5, sm: 3 }, maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Title and Customize on one row: stacked, with a large heading, they
          took most of the first screen on a phone before any figure. */}
      <Box
        sx={{
          mb: { xs: 2, sm: 3 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.4rem', sm: '2rem' } }}>
            Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Overview of your time together
          </Typography>
        </Box>
        <Button
          startIcon={<TuneIcon />}
          onClick={() => setCustomizeOpen(true)}
          variant="outlined"
          size="small"
          sx={{ flexShrink: 0, textTransform: 'none' }}
        >
          Customize
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2.5, sm: 3 } }}>
        {/* Key Statistics */}
        <Box sx={{ width: '100%' }}>
          <StatsCards highlightTypeIds={settings.highlightTypeIds} startDate={settings.startDate} />
        </Box>

        {/* Streaks and staleness nudges */}
        <Box sx={{ width: '100%' }}>
          <StreakCards hiddenTypeIds={settings.hiddenTypeIds} />
        </Box>

        {/* Milestones just reached and coming up */}
        <Box sx={{ width: '100%' }}>
          <MilestonesCard />
        </Box>

        {/* Which way each activity type is moving */}
        <Box sx={{ width: '100%' }}>
          <TrendsCard />
        </Box>

        {/* Recent Activities */}
        <Box sx={{ width: '100%' }}>
          <RecentActivitiesCards />
        </Box>

        {/* Charts Section */}
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <HoursBarChart hiddenSlugs={hiddenSlugs} height={chartHeight} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <TotalHoursChart height={chartHeight} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <TotalDaysChart featuredType={featuredType} height={chartHeight} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <CumulativeTimeline height={chartHeight} />
        </Box>

        {/* Heatmap */}
        <Box sx={{ width: '100%' }}>
          <WeeklyHeatmap hiddenSlugs={hiddenSlugs} />
        </Box>
      </Box>

      <DashboardCustomizeDialog
        open={customizeOpen}
        types={types}
        settings={settings}
        onClose={() => setCustomizeOpen(false)}
        onSave={save}
      />
    </Box>
  );
};

export default Dashboard;
