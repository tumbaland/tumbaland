import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import {
  PhotoLibrary as PhotoLibraryIcon,
  Photo as PhotoIcon,
  Storage as StorageIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { formatBytes } from '../../utils/formatBytes';

interface StatisticsOverviewData {
  totalAlbums: number;
  totalPhotos: number;
  totalStorage: number;
  averagePhotoSize: number;
}

interface StatisticsOverviewProps {
  data: StatisticsOverviewData;
}

/**
 * The four headline figures. Two by two on a phone: one card per row made the
 * figures alone fill most of the first screen.
 */
const StatisticsOverview: React.FC<StatisticsOverviewProps> = ({ data }) => {
  const stats = [
    { title: 'Total Albums', value: data.totalAlbums.toLocaleString(), Icon: PhotoLibraryIcon, color: '#667eea' },
    { title: 'Total Photos', value: data.totalPhotos.toLocaleString(), Icon: PhotoIcon, color: '#22c55e' },
    { title: 'Storage Used', value: formatBytes(data.totalStorage), Icon: StorageIcon, color: '#f59e0b' },
    { title: 'Avg Photo Size', value: formatBytes(data.averagePhotoSize), Icon: ImageIcon, color: '#ef4444' }
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(4, minmax(0, 1fr))'
        },
        gap: { xs: 1.5, sm: 2, md: 3 },
        mb: { xs: 2, sm: 4 }
      }}
    >
      {stats.map(({ title, value, Icon, color }) => (
        <Card
          key={title}
          sx={{
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
            }
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 2 } }}>
              <Icon sx={{ fontSize: { xs: 28, sm: 40 }, color, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{ fontWeight: 700, color: '#1e293b', fontSize: { xs: '1.2rem', sm: '2rem' }, lineHeight: 1.2 }}
                >
                  {value}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ color: '#64748b', fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  {title}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default StatisticsOverview;
