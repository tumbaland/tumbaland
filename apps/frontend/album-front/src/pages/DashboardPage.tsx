import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { Dashboard as DashboardIcon } from '@mui/icons-material';
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
          minHeight: '400px'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!statistics) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No statistics data available</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <DashboardIcon sx={{ mr: 2, color: '#667eea' }} />
        <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e293b' }}>
          Dashboard
        </Typography>
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
          mt: 2
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
    </Box>
  );
};

export default DashboardPage;