import React from 'react';
import { useTenantFilter } from '@tumbaland/components';
import {
  Box,
  Container,
  Typography,
  Alert,
  Button,
  Stack,
  IconButton,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  PhotoLibrary as PhotoLibraryIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useStatistics } from '../hooks/useStatistics';
import { getUserGroups } from '../services/groupService';
import StatisticsOverview from '../components/dashboard/StatisticsOverview';
import TimeSeriesChart from '../components/dashboard/TimeSeriesChart';
import StorageChart from '../components/dashboard/StorageChart';
import TagsChart from '../components/dashboard/TagsChart';
import AIAnalysisChart from '../components/dashboard/AIAnalysisChart';
import GroupDistributionChart from '../components/dashboard/GroupDistributionChart';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const selectedGroupId = useTenantFilter();

  const { statistics, loading, isFetching, error, refetch } = useStatistics(selectedGroupId || undefined);

  // Resolve group ids to readable names for the distribution chart, so it never shows raw ObjectIds.
  const { data: groups } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => getUserGroups(),
    staleTime: 5 * 60 * 1000
  });
  const groupNames = React.useMemo(
    () => Object.fromEntries((groups ?? []).map((g) => [g._id, g.name])),
    [groups]
  );

  const header = (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: { xs: 3, sm: 5 },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <DashboardIcon sx={{ mr: 2, fontSize: 32, color: '#667eea' }} />
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Dashboard
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
        <Button
          variant="outlined"
          startIcon={<PhotoLibraryIcon />}
          onClick={() => navigate('/albums')}
          sx={{
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: '#667eea',
            color: '#667eea',
            '&:hover': {
              borderColor: '#5a67d8',
              backgroundColor: 'rgba(102, 126, 234, 0.04)'
            }
          }}
        >
          View Albums
        </Button>
        <Button
          variant="outlined"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => navigate('/collages')}
          sx={{
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: '#8b5cf6',
            color: '#8b5cf6',
            '&:hover': {
              borderColor: '#7c3aed',
              backgroundColor: 'rgba(139, 92, 246, 0.04)'
            }
          }}
        >
          View Collages
        </Button>
      </Stack>
    </Box>
  );

  // First load with no cached data yet: show the header plus a progress bar
  // rather than a bare full-page spinner, so the page frame stays stable.
  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
        {header}
        <LinearProgress sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

  if (error && !statistics) {
    return (
      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
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
      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
        {header}
        <Alert severity="info">No statistics data available</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      {header}

      {/* Non-blocking indicator while re-fetching (e.g. after switching group filter) */}
      <Box sx={{ height: 4, mb: 2 }}>
        {isFetching && <LinearProgress sx={{ borderRadius: 2 }} />}
      </Box>

      {/* Statistics Overview Cards */}
      <StatisticsOverview data={statistics.overview} />

      {/* Charts Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: '2fr 1fr'
          },
          gap: 3,
          mt: 2,
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

        {/* Storage and AI Analysis */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateRows: '1fr 1fr',
            gap: 3
          }}
        >
          <StorageChart
            totalStorage={statistics.overview.totalStorage}
            averagePhotoSize={statistics.overview.averagePhotoSize}
            topAlbums={statistics.albums.map((album) => ({
              albumId: album.albumId,
              name: album.name,
              totalSize: album.totalSize
            }))}
          />
          <AIAnalysisChart data={statistics.aiAnalysis} />
        </Box>

        {/* Tags and Group Distribution */}
        <Box
          sx={{
            gridColumn: { xs: '1', lg: '1 / -1' },
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: '1fr 1fr'
            },
            gap: 3,
            mt: 3
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