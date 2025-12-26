import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  useMediaQuery,
  useTheme
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
        border: '1px solid rgba(255,255,255,0.2)'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Timeline sx={{ mr: 2, color: '#667eea' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Activity Over Time
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 300, px: { xs: 0, sm: 1, md: 2 } }}>
          <LineChart
            xAxis={[{
              data: allDates,
              scaleType: 'point',
              tickLabelInterval: (_, index) => {
                const totalPoints = allDates.length;
                if (isMobile) {
                  // Mobile: show only start and end
                  return index === 0 || index === totalPoints - 1;
                } else {
                  // Desktop: show start, 25%, 50%, 75%, and end
                  const keyIndices = [0, Math.floor(totalPoints * 0.25), Math.floor(totalPoints * 0.5), Math.floor(totalPoints * 0.75), totalPoints - 1];
                  return keyIndices.includes(index);
                }
              },
              valueFormatter: (value) => {
                // Format dates as MM/YY for shorter display
                const date = new Date(value);
                return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
              }
            }]}
            yAxis={[{
              scaleType: 'linear'
            }]}
            series={series}
            height={300}
            width={undefined}
            margin={{
              top: 10,
              right: 20,
              bottom: 40,
              left: 10
            }}
            grid={{ horizontal: true, vertical: false }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default TimeSeriesChart;