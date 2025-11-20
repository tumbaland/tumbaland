import React from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { LineChart } from '@mui/x-charts';
import { Training, Epoch } from '../types';
import ClassIoUChart from '../components/ClassIoUChart';
import TrainingTimeMetrics from '../components/TrainingTimeMetrics';
import TrainingOverviewCard from '../components/TrainingOverviewCard';
import ClassPrecisionChart from '../components/ClassPrecisionChart';
import ClassRecallChart from '../components/ClassRecallChart';
import ClassF1Chart from '../components/ClassF1Chart';
import ClassIoUOverEpochsChart from '../components/ClassIoUOverEpochsChart';
import ChartComments from '../components/ChartComments';

interface TrainingOverviewTabProps {
  training: Training;
  epochs: Epoch[];
  trainingId: string;
}

const TrainingOverviewTab: React.FC<TrainingOverviewTabProps> = ({
  training,
  epochs,
  trainingId
}) => {
  // Calculate chart data
  const lastEpoch = epochs[epochs.length - 1];
  const classMetrics = lastEpoch?.results?.metrics?.per_class || {};
  const epochNumbers = epochs.map(e => e.epoch);
  const trainMeanIoU = epochs.map(e => e.results?.train?.mean_iou ?? null);
  const valMeanIoU = epochs.map(e => e.results?.val?.mean_iou ?? null);
  const trainStandardIoU = epochs.map(e => e.results?.train_standard?.mean_iou ?? null);
  const valStandardIoU = epochs.map(e => e.results?.val_standard?.mean_iou ?? null);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Training Overview Card */}
      <TrainingOverviewCard training={training} epochs={epochs} />

      {/* Mean IoU Chart */}
      {epochs.length > 0 && (trainMeanIoU.some(v => v !== undefined) || valMeanIoU.some(v => v !== undefined) || trainStandardIoU.some(v => v !== null) || valStandardIoU.some(v => v !== null)) && (
        <Paper sx={{ p: 3, position: 'relative' }}>
          <Typography variant="h6" gutterBottom>Standard Training IoU and Modified IoU Over Epochs</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Comparison of standard IoU (official evaluation protocol) and modified IoU (training metrics) over epochs.
            Standard IoU uses the official evaluation method, while modified IoU may use different preprocessing or metrics.
          </Typography>
          <Box sx={{ width: '100%', height: 350 }}>
            <LineChart
              xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
              series={[
                { data: trainStandardIoU, label: 'Training Standard IoU', color: '#1976d2', showMark: false },
                { data: valStandardIoU, label: 'Validation Standard IoU', color: '#2e7d32', showMark: false },
                { data: trainMeanIoU, label: 'Training Modified IoU', color: '#d32f2f', showMark: false },
                { data: valMeanIoU, label: 'Validation Modified IoU', color: '#f57c00', showMark: false }
              ]}
              margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
            />
          </Box>
          <ChartComments trainingId={trainingId} section="combined_iou_chart" />
        </Paper>
      )}

      {/* Training Time Metrics */}
      <TrainingTimeMetrics epochs={epochs} trainingId={trainingId} />

      {/* Class IoU Chart */}
      <ClassIoUChart epochs={epochs} trainingId={trainingId} />


      {/* Class IoU Over Epochs Chart */}
      <ClassIoUOverEpochsChart epochs={epochs} trainingId={trainingId} />

      {/* Class Precision Chart */}
      <ClassPrecisionChart epochs={epochs} trainingId={trainingId} />

      {/* Class Recall Chart */}
      <ClassRecallChart epochs={epochs} trainingId={trainingId} />

      {/* Class F1 Chart */}
      <ClassF1Chart epochs={epochs} trainingId={trainingId} />

      {/* Per-Class Metrics Table */}
      {Object.keys(classMetrics).length > 0 && (
        <Paper>
          <Box p={3}>
            <Typography variant="h6" gutterBottom>Per-Class Validation Metrics (Latest Epoch)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              These metrics are calculated on the validation dataset and represent the model's performance on unseen data during training.
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
    </Box>
  );
};

export default TrainingOverviewTab;