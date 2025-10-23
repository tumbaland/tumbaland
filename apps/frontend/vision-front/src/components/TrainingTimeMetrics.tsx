import React from 'react';
import { Paper, Typography, Box, Card, CardContent } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { Epoch } from '../types';

interface TrainingTimeMetricsProps {
  epochs: Epoch[];
}

const TrainingTimeMetrics: React.FC<TrainingTimeMetricsProps> = ({ epochs }) => {
  if (epochs.length === 0) {
    return null;
  }

  // Format time duration
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
    return `${(seconds / 86400).toFixed(1)}d`;
  };

  // Calculate total training time
  const totalSeconds = epochs.reduce((sum, epoch) => sum + (epoch.epoch_time || 0), 0);
  
  // Get per-epoch times
  const epochNumbers = epochs.map(e => e.epoch);
  const epochTimes = epochs.map(e => e.epoch_time || 0);

  // Calculate average time per epoch
  const avgTimePerEpoch = totalSeconds / epochs.length;

  const hasTimeData = epochTimes.some(t => t > 0);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Time Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Training Time
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {formatTime(totalSeconds)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {totalSeconds.toFixed(0)} seconds
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Epochs Completed
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {epochs.length}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Total epochs
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Avg Time per Epoch
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {formatTime(avgTimePerEpoch)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {avgTimePerEpoch.toFixed(1)} seconds
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Longest Epoch
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {formatTime(Math.max(...epochTimes))}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Maximum duration
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Epoch Time Chart */}
      {hasTimeData && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Time Spent Per Epoch
          </Typography>
          <Box sx={{ width: '100%', height: 350 }}>
            <BarChart
              xAxis={[{ data: epochNumbers, label: 'Epoch', scaleType: 'band' }]}
              series={[{ data: epochTimes, label: 'Time (seconds)', color: '#1976d2' }]}
              margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default TrainingTimeMetrics;
