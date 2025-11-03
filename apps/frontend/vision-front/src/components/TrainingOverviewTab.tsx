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
  const trainLoss = epochs.map(e => e.results?.train?.loss ?? null);
  const valLoss = epochs.map(e => e.results?.val?.loss ?? null);
  const trainMeanIoU = epochs.map(e => e.results?.train?.mean_iou ?? null);
  const valMeanIoU = epochs.map(e => e.results?.val?.mean_iou ?? null);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Training Overview Card */}
      <TrainingOverviewCard training={training} epochs={epochs} />

      {/* Loss Chart */}
      {epochs.length > 0 && trainLoss.some(v => v !== undefined) && (
        <Paper sx={{ p: 3, position: 'relative' }}>
          <Typography variant="h6" gutterBottom>Loss Over Epochs</Typography>
          <Box sx={{ width: '100%', height: 350 }}>
            <LineChart
              xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
              series={[
                { data: trainLoss, label: 'Train Loss', color: '#424242', showMark: false },
                { data: valLoss, label: 'Val Loss', color: '#757575', showMark: false }
              ]}
              margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
            />
          </Box>
          <ChartComments trainingId={trainingId} section="loss_chart" />
        </Paper>
      )}

      {/* Mean IoU Chart */}
      {epochs.length > 0 && trainMeanIoU.some(v => v !== undefined) && (
        <Paper sx={{ p: 3, position: 'relative' }}>
          <Typography variant="h6" gutterBottom>Mean IoU Over Epochs</Typography>
          <Box sx={{ width: '100%', height: 350 }}>
            <LineChart
              xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
              series={[
                { data: trainMeanIoU, label: 'Train mIoU', color: '#212121', showMark: false },
                { data: valMeanIoU, label: 'Val mIoU', color: '#616161', showMark: false }
              ]}
              margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
            />
          </Box>
          <ChartComments trainingId={trainingId} section="iou_chart" />
        </Paper>
      )}

      {/* Training Time Metrics */}
      <TrainingTimeMetrics epochs={epochs} trainingId={trainingId} />

      {/* Class IoU Chart */}
      <ClassIoUChart epochs={epochs} trainingId={trainingId} />

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
            <Typography variant="h6" gutterBottom>Per-Class Metrics (Latest Epoch)</Typography>
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