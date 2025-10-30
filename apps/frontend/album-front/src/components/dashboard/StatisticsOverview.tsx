import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import {
  PhotoLibrary as PhotoLibraryIcon,
  Photo as PhotoIcon,
  Storage as StorageIcon,
  Image as ImageIcon
} from '@mui/icons-material';

interface StatisticsOverviewData {
  totalAlbums: number;
  totalPhotos: number;
  totalStorage: number;
  averagePhotoSize: number;
}

interface StatisticsOverviewProps {
  data: StatisticsOverviewData;
}

const StatisticsOverview: React.FC<StatisticsOverviewProps> = ({ data }) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const stats = [
    {
      title: 'Total Albums',
      value: data.totalAlbums.toLocaleString(),
      icon: <PhotoLibraryIcon sx={{ fontSize: 40, color: '#667eea' }} />,
      color: '#667eea'
    },
    {
      title: 'Total Photos',
      value: data.totalPhotos.toLocaleString(),
      icon: <PhotoIcon sx={{ fontSize: 40, color: '#22c55e' }} />,
      color: '#22c55e'
    },
    {
      title: 'Storage Used',
      value: formatBytes(data.totalStorage),
      icon: <StorageIcon sx={{ fontSize: 40, color: '#f59e0b' }} />,
      color: '#f59e0b'
    },
    {
      title: 'Avg Photo Size',
      value: formatBytes(data.averagePhotoSize),
      icon: <ImageIcon sx={{ fontSize: 40, color: '#ef4444' }} />,
      color: '#ef4444'
    }
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          lg: '1fr 1fr 1fr 1fr'
        },
        gap: 3,
        mb: 4
      }}
    >
      {stats.map((stat, index) => (
        <Card
          key={index}
          sx={{
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
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
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {stat.icon}
              <Box sx={{ ml: 2, flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                  {stat.title}
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