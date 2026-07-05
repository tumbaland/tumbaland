import React, { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import StatsCards from '../components/StatsCards';
import RecentActivitiesCards from '../components/RecentActivitiesCards';
import HoursBarChart from '../components/HoursBarChart';
import TotalHoursChart from '../components/TotalHoursChart';
import TotalDaysChart from '../components/TotalDaysChart';
import WeeklyHeatmap from '../components/WeeklyHeatmap';
import CumulativeTimeline from '../components/CumulativeTimeline';
import DashboardCustomizeDialog from '../components/DashboardCustomizeDialog';
import { useDashboardSettings } from '../hooks/useDashboardSettings';
import { useTenantFilter } from '../components/tenant';

const Dashboard: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { settings, types, save } = useDashboardSettings(tenantGroupId);
  const [customizeOpen, setCustomizeOpen] = useState(false);

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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflowX: 'hidden' }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Overview of your time together
          </Typography>
        </Box>
        <Button
          startIcon={<TuneIcon />}
          onClick={() => setCustomizeOpen(true)}
          variant="outlined"
          size="small"
          sx={{ textTransform: 'none' }}
        >
          Customize
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Key Statistics */}
        <Box sx={{ width: '100%' }}>
          <StatsCards highlightTypeIds={settings.highlightTypeIds} />
        </Box>

        {/* Recent Activities */}
        <Box sx={{ width: '100%' }}>
          <RecentActivitiesCards />
        </Box>

        {/* Charts Section */}
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <HoursBarChart hiddenSlugs={hiddenSlugs} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <TotalHoursChart />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <TotalDaysChart featuredType={featuredType} />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
          <CumulativeTimeline height={400} />
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
