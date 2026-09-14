import React from 'react';
import { useTenantFilter } from '@tumbaland/components';
import { Box, Container, Typography, Alert, Button, IconButton, LinearProgress, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useStatistics } from '../hooks/useStatistics';
import { getUserGroups } from '../services/groupService';
import { getMyEntitlements } from '../services/entitlementsService';
import { getGlobalConfig } from '../config/ConfigProvider';
import StatisticsOverview from '../components/dashboard/StatisticsOverview';
import TimeSeriesChart from '../components/dashboard/TimeSeriesChart';
import StorageChart from '../components/dashboard/StorageChart';
import TagsChart from '../components/dashboard/TagsChart';
import GroupDistributionChart from '../components/dashboard/GroupDistributionChart';

const pageSx = { py: { xs: 1, sm: 4 }, px: { xs: 0, sm: 3 } } as const;

const DashboardPage: React.FC = () => {
  const selectedGroupId = useTenantFilter();

  const { statistics, loading, isFetching, error, refetch } = useStatistics(selectedGroupId || undefined);

  // Resolve group ids to readable names for the distribution chart, so it never shows raw ObjectIds.
  const { data: groups } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => getUserGroups(),
    staleTime: 5 * 60 * 1000
  });
  // Plan limits and live meter readings for the storage bar. `retry: false`
  // and a swallowed error on purpose: the meter is decoration on a page that
  // works without it, so payment-service being down must not cost the user
  // their dashboard.
  const { data: entitlements } = useQuery({
    queryKey: ['myEntitlements'],
    queryFn: () => getMyEntitlements(),
    staleTime: 60 * 1000,
    retry: false
  });

  // The shell owns the URL and hosts each front in an iframe, so an upgrade
  // link navigates the *top* window to the shell's pricing route rather than
  // the embedded one, which would render the plans page inside this frame.
  //
  // Config is read inside the handler, not at render: `getGlobalConfig` throws
  // when no provider has mounted, and a usage bar must never be the reason a
  // dashboard fails to render.
  const goToPlans = React.useCallback(() => {
    let shellFrontUrl: string | undefined;
    try {
      shellFrontUrl = getGlobalConfig().SHELL_FRONT_URL;
    } catch {
      return;
    }
    if (shellFrontUrl && window.top?.location) window.top.location.href = `${shellFrontUrl}/payments`;
  }, []);

  const groupNames = React.useMemo(
    () => Object.fromEntries((groups ?? []).map((g) => [g._id, g.name])),
    [groups]
  );

  // One short line. The section tabs above already lead to Albums and
  // Collages, so the page no longer repeats them as buttons that took up a
  // third of a phone screen before the first figure.
  const header = (
    <Box
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: { xs: 1.5, sm: 3 } }}
    >
      <Typography
        variant="h5"
        component="h1"
        sx={{ fontWeight: 700, color: '#1e293b', fontSize: { xs: '1.35rem', sm: '1.75rem' } }}
      >
        Dashboard
      </Typography>
      <Tooltip title="Refresh statistics">
        <span>
          <IconButton
            onClick={() => refetch()}
            disabled={isFetching}
            color="primary"
            aria-label="Refresh statistics"
          >
            <RefreshIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  // First load with no cached data yet: show the header plus a progress bar
  // rather than a bare full-page spinner, so the page frame stays stable.
  if (loading) {
    return (
      <Container maxWidth="xl" sx={pageSx}>
        {header}
        <LinearProgress sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

  if (error && !statistics) {
    return (
      <Container maxWidth="xl" sx={pageSx}>
        {header}
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  if (!statistics) {
    return (
      <Container maxWidth="xl" sx={pageSx}>
        {header}
        <Alert severity="info">No statistics data available</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={pageSx}>
      {header}

      {/* Non-blocking indicator while re-fetching (e.g. after switching group filter) */}
      <Box sx={{ height: 4, mb: { xs: 1, sm: 2 } }}>
        {isFetching && <LinearProgress sx={{ borderRadius: 2 }} />}
      </Box>

      {/* Statistics Overview Cards */}
      <StatisticsOverview data={statistics.overview} />

      {/* Charts Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: '2fr 1fr'
          },
          gap: { xs: 2, sm: 3 },
          alignItems: 'start'
        }}
      >
        {/* Time Series Charts */}
        <Box>
          <TimeSeriesChart
            albumsData={statistics.timeSeries.albumsCreated}
            photosData={statistics.timeSeries.photosUploaded}
          />
        </Box>

        {/* Storage */}
        <Box>
          <StorageChart
            totalStorage={statistics.overview.totalStorage}
            averagePhotoSize={statistics.overview.averagePhotoSize}
            topAlbums={statistics.albums.map((album) => ({
              albumId: album.albumId,
              name: album.name,
              totalSize: album.totalSize
            }))}
            storageLimit={entitlements?.limits?.meters?.storageBytes}
            meteredStorage={entitlements?.usage?.storageBytes}
            onUpgrade={goToPlans}
          />
        </Box>

        {/* Tags and Group Distribution */}
        <Box
          sx={{
            gridColumn: { xs: '1', lg: '1 / -1' },
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: '1fr 1fr'
            },
            gap: { xs: 2, sm: 3 }
          }}
        >
          <TagsChart tags={statistics.tags} />
          <GroupDistributionChart groups={statistics.groups} groupNames={groupNames} />
        </Box>
      </Box>
    </Container>
  );
};

export default DashboardPage;
