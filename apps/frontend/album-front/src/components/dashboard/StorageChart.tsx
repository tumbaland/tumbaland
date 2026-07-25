import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress
} from '@mui/material';
import { Storage as StorageIcon } from '@mui/icons-material';
import { formatBytes } from '../../utils/formatBytes';

export interface StorageChartAlbum {
  albumId: string;
  name: string;
  totalSize: number;
}

interface StorageChartProps {
  totalStorage: number;
  averagePhotoSize: number;
  /** Top albums by storage used, largest first (see statisticsService.getTopAlbumsByStorage). */
  topAlbums?: StorageChartAlbum[];
}

const StorageChart: React.FC<StorageChartProps> = ({ totalStorage, averagePhotoSize, topAlbums = [] }) => {
  // Relative to the largest album in the list, not a storage cap — there is
  // no plan-level storage limit, so this bar visualizes distribution across
  // albums rather than usage against a quota.
  const largestAlbumSize = topAlbums[0]?.totalSize || 0;

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <StorageIcon sx={{ mr: 2, color: '#f59e0b' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Storage Usage
          </Typography>
        </Box>

        <Box sx={{ mb: 3, display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
              {formatBytes(totalStorage)}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Total storage used
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
              {formatBytes(averagePhotoSize)}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Average photo size
            </Typography>
          </Box>
        </Box>

        {topAlbums.length > 0 && (
          <Box>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>
              Largest albums
            </Typography>
            {topAlbums.map((album) => (
              <Box key={album.albumId} sx={{ mb: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" noWrap sx={{ color: '#1e293b', maxWidth: '70%' }}>
                    {album.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                    {formatBytes(album.totalSize)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={largestAlbumSize > 0 ? (album.totalSize / largestAlbumSize) * 100 : 0}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#e5e7eb',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      backgroundColor: '#f59e0b'
                    }
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageChart;