import React from 'react';
import { ink, useTenantFilter } from '@tumbaland/frontend-core';
import { Box, Container, Typography, Alert, Button, IconButton, LinearProgress, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useStatistics } from '../hooks/useStatistics';
import { getMyEntitlements } from '../services/entitlementsService';
import { getGlobalConfig } from '../config/ConfigProvider';
import StatisticsOverview from '../components/dashboard/StatisticsOverview';
import StorageChart from '../components/dashboard/StorageChart';
import RecentCollages from '../components/dashboard/RecentCollages';
import RecentUploads from '../components/dashboard/RecentUploads';
import Rediscover from '../components/dashboard/Rediscover';
import OnThisDay from '../components/OnThisDay';

const pageSx = { py: { xs: 1, sm: 4 }, px: { xs: 0, sm: 3 } } as const;

const DashboardPage: React.FC = () => {
  const selectedGroupId = useTenantFilter();

  const { statistics, loading, isFetching, error, refetch } = useStatistics(selectedGroupId || undefined);

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
        sx={{ fontWeight: 700, color: ink.strong, fontSize: { xs: '1.35rem', sm: '1.75rem' } }}
      >
        Dashboard
      </Typography>
      <Tooltip title="Refresh statistics">
        <span>
          <IconButton onClick={() => refetch()} disabled={isFetching} color="primary" aria-label="Refresh statistics">
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
      <Box sx={{ height: 4, mb: { xs: 1, sm: 2 } }}>{isFetching && <LinearProgress sx={{ borderRadius: 2 }} />}</Box>

      {/* Statistics Overview Cards */}
      <StatisticsOverview data={statistics.overview} />

      {/* Things to look at, then the one figure worth a chart. Each card
          renders nothing when it has nothing, so the column closes up rather
          than leaving a gap. `OnThisDay` only fires on a day with history,
          which most days in a young library are not. Collages come before the
          random pick, and "Remember this?" shares the last line with storage. */}
      <Box sx={{ display: 'grid', gap: { xs: 2, sm: 3 }, alignItems: 'start' }}>
        <OnThisDay groupId={selectedGroupId || undefined} />

        <RecentUploads groupId={selectedGroupId || undefined} />

        <RecentCollages />

        {/* Side by side where there is room, stacked on a phone. Wrapping
            rather than a fixed two-column grid, so storage takes the whole
            line on a day "Remember this?" has nothing to show. */}
        <Box
          data-testid="rediscover-and-storage"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            gap: { xs: 2, sm: 3 },
            '& > *': { flex: '1 1 360px', minWidth: 0 }
          }}
        >
          <Rediscover groupId={selectedGroupId || undefined} />

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
      </Box>
    </Container>
  );
};

export default DashboardPage;
