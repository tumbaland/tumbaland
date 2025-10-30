import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { Timeline } from '@mui/icons-material';
import { LineChart } from '@mui/x-charts';

interface TimeSeriesData {
  date: string;
  count: number;
}

interface TimeSeriesChartProps {
  albumsData: TimeSeriesData[];
  photosData: TimeSeriesData[];
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ albumsData, photosData }) => {
  // Combine and sort dates
  const allDates = [...new Set([...albumsData.map(d => d.date), ...photosData.map(d => d.date)])].sort();

  // Create series data
  const albumsSeries = allDates.map(date => {
    const data = albumsData.find(d => d.date === date);
    return data ? data.count : 0;
  });

  const photosSeries = allDates.map(date => {
    const data = photosData.find(d => d.date === date);
    return data ? data.count : 0;
  });

  const series = [
    {
      id: 'albums',
      label: 'Albums Created',
      data: albumsSeries,
      color: '#667eea',
      showMark: false,
      curve: 'monotoneX' as const
    },
    {
      id: 'photos',
      label: 'Photos Uploaded',
      data: photosSeries,
      color: '#22c55e',
      showMark: false,
      curve: 'monotoneX' as const
    }
  ];

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
          <Timeline sx={{ mr: 2, color: '#667eea' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Activity Over Time
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 300 }}>
          <LineChart
            xAxis={[{
              data: allDates,
              scaleType: 'point',
              tickLabelInterval: (_, index) => {
                const totalPoints = allDates.length;
                // Show labels at: start, 25%, 50%, 75%, and end
                const keyIndices = [0, Math.floor(totalPoints * 0.25), Math.floor(totalPoints * 0.5), Math.floor(totalPoints * 0.75), totalPoints - 1];
                return keyIndices.includes(index);
              }
            }]}
            yAxis={[{
              label: 'Count',
              labelStyle: { textAnchor: 'middle' },
              scaleType: 'linear'
            }]}
            series={series}
            height={300}
            margin={{
              top: 20,
              right: 30,
              bottom: 60,
              left: 60
            }}
            grid={{ horizontal: true, vertical: false }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default TimeSeriesChart;