import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress
} from '@mui/material';
import { Storage as StorageIcon } from '@mui/icons-material';

interface StorageChartProps {
  totalStorage: number;
  averagePhotoSize: number;
}

const StorageChart: React.FC<StorageChartProps> = ({ totalStorage, averagePhotoSize }) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Calculate storage usage percentage (assuming 10GB limit for demo)
  const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB
  const usagePercentage = Math.min((totalStorage / storageLimit) * 100, 100);

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

        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
            {formatBytes(totalStorage)}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Total storage used
          </Typography>

          <LinearProgress
            variant="determinate"
            value={usagePercentage}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#e5e7eb',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: usagePercentage > 80 ? '#ef4444' : '#22c55e'
              }
            }}
          />
          <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>
            {usagePercentage.toFixed(1)}% of 10GB limit
          </Typography>
        </Box>

        <Box>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
            Average photo size
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            {formatBytes(averagePhotoSize)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StorageChart;