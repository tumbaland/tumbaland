import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { LineChart } from '@mui/x-charts';
import { Epoch } from '../types';

interface ClassIoUChartProps {
  epochs: Epoch[];
}

const ClassIoUChart: React.FC<ClassIoUChartProps> = ({ epochs }) => {
  if (epochs.length === 0) {
    return null;
  }

  // Extract all unique class names from all epochs
  // Support multiple data structures
  const allClasses = new Set<string>();
  const EXCLUDED_KEYS = new Set(['loss', 'mean_iou', 'learning_rate', 'epoch_time', 'timestamp']);

  epochs.forEach(epoch => {
    // Try validation results first
    const valResults = epoch.results?.val as Record<string, any> || {};
    Object.keys(valResults).forEach(key => {
      if (!EXCLUDED_KEYS.has(key) && valResults[key]?.iou !== undefined) {
        allClasses.add(key);
      }
    });

    // If no classes found in val, try train
    if (allClasses.size === 0) {
      const trainResults = epoch.results?.train as Record<string, any> || {};
      Object.keys(trainResults).forEach(key => {
        if (!EXCLUDED_KEYS.has(key) && trainResults[key]?.iou !== undefined) {
          allClasses.add(key);
        }
      });
    }

    // Try per_class structure
    if (allClasses.size === 0) {
      let perClass = epoch.results?.val?.per_class as Record<string, any> || {};
      if (Object.keys(perClass).length === 0) {
        perClass = epoch.results?.train?.per_class as Record<string, any> || {};
      }
      if (Object.keys(perClass).length === 0) {
        perClass = epoch.results?.metrics?.per_class as Record<string, any> || {};
      }
      Object.keys(perClass).forEach(key => allClasses.add(key));
    }
  });

  if (allClasses.size === 0) {
    return null;
  }

  // Build chart data for each class
  const epochNumbers = epochs.map(e => e.epoch);
  const classesArray = Array.from(allClasses).sort();
  
  // Color palette for classes
  const colors = [
    '#1976d2', // blue
    '#d32f2f', // red
    '#f57c00', // orange
    '#388e3c', // green
    '#7b1fa2', // purple
    '#00796b', // teal
    '#c2185b', // pink
    '#0097a7', // cyan
    '#fbc02d', // yellow
    '#6a1b9a'  // deep purple
  ];

  const series = classesArray.map((className, index) => {
    const classIoUData = epochs.map(epoch => {
      // Try validation results first
      let valResults = epoch.results?.val as Record<string, any> || {};
      let iouValue = valResults[className]?.iou;

      // Try training results if val doesn't have it
      if (iouValue === undefined) {
        const trainResults = epoch.results?.train as Record<string, any> || {};
        iouValue = trainResults[className]?.iou;
      }

      // Try per_class structures
      if (iouValue === undefined) {
        let perClass = epoch.results?.val?.per_class as Record<string, any> || {};
        iouValue = perClass[className]?.iou;
      }

      if (iouValue === undefined) {
        let perClass = epoch.results?.train?.per_class as Record<string, any> || {};
        iouValue = perClass[className]?.iou;
      }

      if (iouValue === undefined) {
        let perClass = epoch.results?.metrics?.per_class as Record<string, any> || {};
        iouValue = perClass[className]?.iou;
      }

      return iouValue ?? null;
    });

    return {
      data: classIoUData,
      label: className,
      color: colors[index % colors.length]
    };
  });

  const hasData = series.some(s => s.data.some(v => v !== null && v !== 0));

  if (!hasData) {
    return null;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Class IoU Over Epochs
      </Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <LineChart
          xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
          series={series}
          margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
          slotProps={{
            legend: {
              direction: 'column' as const,
              position: { vertical: 'top' as const, horizontal: 'right' as const },
              padding: 10
            }
          }}
        />
      </Box>
    </Paper>
  );
};

export default ClassIoUChart;
