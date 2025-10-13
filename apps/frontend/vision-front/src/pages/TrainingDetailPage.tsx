import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, BarChart } from '@mui/x-charts';
import { trainingService } from '../services/trainingService';
import { Training } from '../types';

const TrainingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['training', id],
    queryFn: () => trainingService.getTrainingWithEpochs(id!),
    enabled: !!id
  });

  const training = data?.data?.training;
  const epochs = data?.data?.epochs || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: Training['status']): 'success' | 'error' | 'default' | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'default';
      case 'failed':
        return 'error';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !training) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load training details'}
        </Alert>
      </Container>
    );
  }

  // Extract metrics data for charts
  const epochNumbers = epochs.map(e => e.epoch);
  const trainLoss = epochs.map(e => e.results?.train?.loss ?? null);
  const valLoss = epochs.map(e => e.results?.val?.loss ?? null);
  const trainMeanIoU = epochs.map(e => e.results?.train?.mean_iou ?? null);
  const valMeanIoU = epochs.map(e => e.results?.val?.mean_iou ?? null);
  const learningRates = epochs.map(e => e.learning_rate ?? null);
  const epochTimes = epochs.map(e => e.epoch_time ?? null);

  // Calculate cumulative training time
  const cumulativeTime = epochTimes.reduce((acc, time, index) => {
    const prevTime = acc[index - 1] || 0;
    if (time === null || time === undefined || time < 0 || time > 86400) { // Sanity check: max 24h per epoch
      acc.push(prevTime);
    } else {
      acc.push(prevTime + time);
    }
    return acc;
  }, [] as number[]);

  // Debug: log total time
  const totalTime = cumulativeTime[cumulativeTime.length - 1] || 0;
  console.log('Total training time:', totalTime, 'seconds (~', (totalTime / 3600).toFixed(1), 'hours)');

  // Format time for display
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
    if (seconds < 604800) return `${(seconds / 86400).toFixed(1)}d`; // days
    return `${(seconds / 604800).toFixed(1)}w`; // weeks
  };

  // Extract per-class metrics from the last epoch
  const lastEpoch = epochs[epochs.length - 1];
  const classMetrics = lastEpoch?.results?.metrics?.per_class || {};

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/trainings')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Training Details
          </Typography>
        </Box>
        <IconButton onClick={() => refetch()} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Box display="flex" flexDirection="column" gap={3}>
        {/* Training Info Card */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  {training.name}
                </Typography>
                {training.description && (
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {training.description}
                  </Typography>
                )}
              </Box>
              <Chip
                label={training.status}
                color={getStatusColor(training.status)}
                sx={{ textTransform: 'capitalize' }}
              />
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Dataset ID
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {training.datasetId || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Training UUID
                </Typography>
                <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-all' }}>
                  {training.training_uuid || training.uuid || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatDate(training.createdAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatDate(training.updatedAt)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Configuration and Summary Cards */}
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
          {/* Configuration Card */}
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {training.configuration ? (
                <Box
                  component="pre"
                  sx={{
                    bgcolor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 400,
                    fontSize: '0.875rem'
                  }}
                >
                  {JSON.stringify(training.configuration, null, 2)}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No configuration available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Epochs Summary Card */}
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Epochs Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {epochs.length > 0 ? (
                <Box>
                  <Box mb={2}>
                    <Typography variant="caption" color="text.secondary">
                      Latest Epoch
                    </Typography>
                    <Typography variant="h4">
                      {epochs[epochs.length - 1]?.epoch}
                    </Typography>
                  </Box>
                  {lastEpoch && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Latest Metrics
                      </Typography>
                      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Train Loss</Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {lastEpoch.results?.train?.loss?.toFixed(4) || '-'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Val Loss</Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {lastEpoch.results?.val?.loss?.toFixed(4) || '-'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Train mIoU</Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {lastEpoch.results?.train?.mean_iou?.toFixed(4) || '-'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Val mIoU</Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {lastEpoch.results?.val?.mean_iou?.toFixed(4) || '-'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No epoch data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Dataset Information */}
        {training.metadata?.dataset_info && (() => {
          const datasetInfo = training.metadata.dataset_info;
          const classes = datasetInfo.segmentation_statistics?.classes;
          const classNames = classes ? Object.values(classes).map((cls: any) => cls.name || 'Unknown') : [];
          const pixelData = classes ? Object.values(classes).map((cls: any) => cls.total_pixels || 0) : [];
          const frameData = classes ? Object.values(classes).map((cls: any) => cls.frames_with_class || 0) : [];

          // Calculate percentages
          const totalFrames = datasetInfo.dataset_overview?.total_frames || 1;
          const totalPixels = datasetInfo.dataset_overview?.total_pixels || 1;

          const datasetSplitPercentages = datasetInfo.dataset_splits ? [
            ((datasetInfo.dataset_splits.train_frames || 0) / totalFrames * 100).toFixed(1),
            ((datasetInfo.dataset_splits.validation_frames || 0) / totalFrames * 100).toFixed(1),
            ((datasetInfo.dataset_splits.test_frames || 0) / totalFrames * 100).toFixed(1)
          ] : ['0.0', '0.0', '0.0'];

          const pixelPercentages = pixelData.map(pixels => ((pixels / totalPixels) * 100).toFixed(1));
          const framePercentages = frameData.map(frames => ((frames / totalFrames) * 100).toFixed(1));

          return (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 3 }}>
                Dataset Information
              </Typography>

              {/* Dataset Overview Card */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Dataset Overview
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Dataset Name
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {datasetInfo.dataset_overview?.name || '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Version
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {datasetInfo.dataset_overview?.version || '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Frames
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {datasetInfo.dataset_overview?.total_frames?.toLocaleString() || '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Classes
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {Object.keys(datasetInfo.dataset_overview?.classes || {}).length}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Dataset Charts Grid */}
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }} gap={3} sx={{ mb: 3 }}>
                {/* Dataset Splits Chart */}
                {datasetInfo.dataset_splits && (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Dataset Splits
                    </Typography>
                    <Box sx={{ width: '100%', height: { xs: 300, sm: 350, md: 400 } }}>
                      <BarChart
                        xAxis={[{ scaleType: 'band', data: ['Train', 'Validation', 'Test'] }]}
                        series={[{
                          data: [
                            datasetInfo.dataset_splits.train_frames || 0,
                            datasetInfo.dataset_splits.validation_frames || 0,
                            datasetInfo.dataset_splits.test_frames || 0
                          ],
                          label: 'Frames',
                          color: '#1976d2',
                          valueFormatter: (value, context) => {
                            const percentage = datasetSplitPercentages[context.dataIndex];
                            return `${value?.toLocaleString() || 0} (${percentage}%)`;
                          }
                        }]}
                        margin={{ top: 20, bottom: 40, left: 60, right: 20 }}
                      />
                    </Box>
                  </Paper>
                )}

                {/* Test Set Weather Breakdown Chart */}
                {datasetInfo.dataset_splits?.test_breakdown && (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Test Set Weather Conditions
                    </Typography>
                    <Box sx={{ width: '100%', height: { xs: 300, sm: 350, md: 400 } }}>
                      <BarChart
                        xAxis={[{ scaleType: 'band', data: ['Day Fair', 'Day Rain', 'Night Fair', 'Night Rain'] }]}
                        series={[{
                          data: [
                            datasetInfo.dataset_splits.test_breakdown.day_fair?.count || 0,
                            datasetInfo.dataset_splits.test_breakdown.day_rain?.count || 0,
                            datasetInfo.dataset_splits.test_breakdown.night_fair?.count || 0,
                            datasetInfo.dataset_splits.test_breakdown.night_rain?.count || 0
                          ],
                          label: 'Frames',
                          color: '#ff9800',
                          valueFormatter: (value, context) => {
                            const conditions = ['day_fair', 'day_rain', 'night_fair', 'night_rain'];
                            const condition = conditions[context.dataIndex];
                            const percentage = datasetInfo.dataset_splits.test_breakdown[condition]?.percentage?.toFixed(1) || '0.0';
                            return `${value?.toLocaleString() || 0} (${percentage}%)`;
                          }
                        }]}
                        margin={{ top: 20, bottom: 40, left: 60, right: 20 }}
                      />
                    </Box>
                  </Paper>
                )}

                {/* Class Distribution Chart */}
                {classes && classNames.length > 0 && (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Class Pixel Distribution
                    </Typography>
                    <Box sx={{ width: '100%', height: { xs: 300, sm: 350, md: 400 } }}>
                      <BarChart
                        xAxis={[{ scaleType: 'band', data: classNames }]}
                        series={[{
                          data: pixelData,
                          label: 'Pixels',
                          color: '#2e7d32',
                          valueFormatter: (value, context) => {
                            const percentage = pixelPercentages[context.dataIndex];
                            return `${(value || 0).toLocaleString()} (${percentage}%)`;
                          }
                        }]}
                        margin={{ top: 20, bottom: 60, left: 60, right: 20 }}
                      />
                    </Box>
                  </Paper>
                )}

                {/* Frames per Class Chart */}
                {classes && classNames.length > 0 && (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Frames Containing Each Class
                    </Typography>
                    <Box sx={{ width: '100%', height: { xs: 300, sm: 350, md: 400 } }}>
                      <BarChart
                        xAxis={[{ scaleType: 'band', data: classNames }]}
                        series={[{
                          data: frameData,
                          label: 'Frames',
                          color: '#ed6c02',
                          valueFormatter: (value, context) => {
                            const percentage = framePercentages[context.dataIndex];
                            return `${value?.toLocaleString() || 0} (${percentage}%)`;
                          }
                        }]}
                        margin={{ top: 20, bottom: 60, left: 60, right: 20 }}
                      />
                    </Box>
                  </Paper>
                )}
              </Box>
            </Box>
          );
        })()}

        {/* Loss Chart */}
        {epochs.length > 0 && trainLoss.some(v => v !== undefined) && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Loss Over Epochs
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 250, sm: 300, md: 350 } }}>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  { data: trainLoss, label: 'Train Loss', color: '#424242' },
                  { data: valLoss, label: 'Val Loss', color: '#757575' }
                ]}
                margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'top', horizontal: 'middle' },
                    padding: 0,
                    itemMarkWidth: 10,
                    itemMarkHeight: 2,
                    markGap: 5,
                    itemGap: 15,
                    labelStyle: {
                      fontSize: 12
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Mean IoU Chart */}
        {epochs.length > 0 && trainMeanIoU.some(v => v !== undefined) && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Mean IoU Over Epochs
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 250, sm: 300, md: 350 } }}>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  { data: trainMeanIoU, label: 'Train mIoU', color: '#212121' },
                  { data: valMeanIoU, label: 'Val mIoU', color: '#616161' }
                ]}
                margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'top', horizontal: 'middle' },
                    padding: 0,
                    itemMarkWidth: 10,
                    itemMarkHeight: 2,
                    markGap: 5,
                    itemGap: 15,
                    labelStyle: {
                      fontSize: 12
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Learning Rate Chart */}
        {epochs.length > 0 && learningRates.some(v => v !== null) && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Learning Rate Schedule (×10⁶)
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 250, sm: 300, md: 350 } }}>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: learningRates.map(lr => lr ? lr * 1000000 : null),
                    label: 'Learning Rate × 10⁶',
                    color: '#424242'
                  }
                ]}
                margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'top', horizontal: 'middle' },
                    padding: 0,
                    itemMarkWidth: 10,
                    itemMarkHeight: 2,
                    markGap: 5,
                    itemGap: 15,
                    labelStyle: {
                      fontSize: 12
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Training Time Chart */}
        {epochs.length > 0 && epochTimes.some(v => v !== null) && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Cumulative Training Time
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 250, sm: 300, md: 350 } }}>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                yAxis={[{
                  label: 'Cumulative Time',
                  valueFormatter: (value) => formatTime(value as number)
                }]}
                series={[
                  {
                    data: cumulativeTime,
                    label: 'Total Training Time',
                    color: '#616161',
                    valueFormatter: (value) => value ? formatTime(value as number) : '0s'
                  }
                ]}
                margin={{ top: 10, bottom: 60, left: 100, right: 10 }}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'top', horizontal: 'middle' },
                    padding: 0,
                    itemMarkWidth: 10,
                    itemMarkHeight: 2,
                    markGap: 5,
                    itemGap: 15,
                    labelStyle: {
                      fontSize: 12
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Class IoU Over Time Chart */}
        {epochs.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Class IoU Over Time
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 300, sm: 350, md: 400 } }}>
              <LineChart
                xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                series={[
                  {
                    data: epochs.map(epoch => (epoch.results?.val?.vehicle as any)?.iou || 0),
                    label: 'Vehicle (Val)',
                    color: '#e57373'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.train?.vehicle as any)?.iou || 0),
                    label: 'Vehicle (Train)',
                    color: '#ffcdd2'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.val?.sign as any)?.iou || 0),
                    label: 'Sign (Val)',
                    color: '#81c784'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.train?.sign as any)?.iou || 0),
                    label: 'Sign (Train)',
                    color: '#c8e6c9'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.val?.cyclist as any)?.iou || 0),
                    label: 'Cyclist (Val)',
                    color: '#64b5f6'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.train?.cyclist as any)?.iou || 0),
                    label: 'Cyclist (Train)',
                    color: '#bbdefb'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.val?.pedestrian as any)?.iou || 0),
                    label: 'Pedestrian (Val)',
                    color: '#ffb74d'
                  },
                  {
                    data: epochs.map(epoch => (epoch.results?.train?.pedestrian as any)?.iou || 0),
                    label: 'Pedestrian (Train)',
                    color: '#ffe0b2'
                  }
                ]}
                margin={{ top: 10, bottom: 60, left: 60, right: 10 }}
                slotProps={{
                  legend: {
                    direction: 'row',
                    position: { vertical: 'top', horizontal: 'middle' },
                    padding: 0,
                    itemMarkWidth: 10,
                    itemMarkHeight: 2,
                    markGap: 5,
                    itemGap: 10,
                    labelStyle: {
                      fontSize: 11
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Per-Class Metrics Table */}
        {Object.keys(classMetrics).length > 0 && (
          <Paper>
            <Box p={3}>
              <Typography variant="h6" gutterBottom>
                Per-Class Metrics (Latest Epoch)
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Class</strong></TableCell>
                    <TableCell align="right"><strong>IoU</strong></TableCell>
                    <TableCell align="right"><strong>Precision</strong></TableCell>
                    <TableCell align="right"><strong>Recall</strong></TableCell>
                    <TableCell align="right"><strong>F1 Score</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(classMetrics).map(([className, metrics]: [string, any]) => (
                    <TableRow key={className}>
                      <TableCell>{className}</TableCell>
                      <TableCell align="right">{metrics.iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{metrics.precision?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{metrics.recall?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{metrics.f1?.toFixed(4) || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* All Epochs Table */}
        {epochs.length > 0 && (
          <Paper>
            <Box p={3}>
              <Typography variant="h6" gutterBottom>
                All Epochs
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Epoch</strong></TableCell>
                    <TableCell align="right"><strong>Train Loss</strong></TableCell>
                    <TableCell align="right"><strong>Val Loss</strong></TableCell>
                    <TableCell align="right"><strong>Train mIoU</strong></TableCell>
                    <TableCell align="right"><strong>Val mIoU</strong></TableCell>
                    <TableCell align="right"><strong>Vehicle IoU</strong></TableCell>
                    <TableCell align="right"><strong>Sign IoU</strong></TableCell>
                    <TableCell align="right"><strong>Cyclist IoU</strong></TableCell>
                    <TableCell align="right"><strong>Pedestrian IoU</strong></TableCell>
                    <TableCell align="right"><strong>Learning Rate</strong></TableCell>
                    <TableCell align="right"><strong>Time (s)</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {epochs.map((epoch) => (
                    <TableRow key={epoch._id}>
                      <TableCell>{epoch.epoch}</TableCell>
                      <TableCell align="right">{epoch.results?.train?.loss?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{epoch.results?.val?.loss?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{epoch.results?.train?.mean_iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{epoch.results?.val?.mean_iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{(epoch.results?.val?.vehicle as any)?.iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{(epoch.results?.val?.sign as any)?.iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{(epoch.results?.val?.cyclist as any)?.iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{(epoch.results?.val?.pedestrian as any)?.iou?.toFixed(4) || '-'}</TableCell>
                      <TableCell align="right">{epoch.learning_rate?.toExponential(2) || '-'}</TableCell>
                      <TableCell align="right">{epoch.epoch_time?.toFixed(2) || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default TrainingDetailPage;
