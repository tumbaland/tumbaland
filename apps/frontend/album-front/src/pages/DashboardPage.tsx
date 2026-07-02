import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Stack
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  PhotoLibrary as PhotoLibraryIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { albumService } from '../services/albumService';
import { AlbumStatistics } from '../types';
import { useTenantFilter } from '../components/tenant';
import StatisticsOverview from '../components/dashboard/StatisticsOverview';
import TimeSeriesChart from '../components/dashboard/TimeSeriesChart';
import StorageChart from '../components/dashboard/StorageChart';
import TagsChart from '../components/dashboard/TagsChart';
import AIAnalysisChart from '../components/dashboard/AIAnalysisChart';
import GroupDistributionChart from '../components/dashboard/GroupDistributionChart';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const selectedGroupId = useTenantFilter();

  const [statistics, setStatistics] = useState<AlbumStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await albumService.getAlbumStatistics({
          groupId: selectedGroupId || undefined
        });
        setStatistics(response);
      } catch (err) {
        console.error('Failed to fetch statistics:', err);
        setError('Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [selectedGroupId]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!statistics) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="info">No statistics data available</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      {/* Header & Actions */}
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

        <Stack direction="row" spacing={2}>
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
          <GroupDistributionChart groups={statistics.groups} />
        </Box>
      </Box>
    </Container>
  );
};

export default DashboardPage;