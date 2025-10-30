import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { BarChart as BarChartIcon } from '@mui/icons-material';
import { BarChart } from '@mui/x-charts';

interface PerformanceData {
  categories: string[];
  gains: number[];
  colors: string[];
}

interface PerformanceChartProps {
  data: PerformanceData;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Sort data by gains descending
  const sortedData = React.useMemo(() => {
    if (!data.categories.length) return { categories: [], gains: [], colors: [] };

    // Create array of items with gains for sorting
    const items = data.categories.map((category, index) => ({
      category,
      gain: data.gains[index],
      color: data.colors[index]
    }));

    // Sort by gain descending
    items.sort((a, b) => b.gain - a.gain);

    // Calculate total gains
    const totalGains = data.gains.reduce((sum, gain) => sum + gain, 0);

    // Return sorted data without total as a bar
    const sortedCategories = items.map(item => item.category);
    const sortedGains = items.map(item => item.gain);
    const sortedColors = items.map(item => item.color);

    return {
      categories: sortedCategories,
      gains: sortedGains,
      colors: sortedColors,
      totalGains
    };
  }, [data]);

  if (!sortedData.categories.length) {
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
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <BarChartIcon sx={{ mr: 2, color: '#764ba2' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Investment Gains by Asset
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No performance data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

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
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <BarChartIcon sx={{ mr: 2, color: '#764ba2' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Investment Gains by Asset
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 300 }}>
          <BarChart
            yAxis={[{
              data: sortedData.categories,
              scaleType: 'band'
            }]}
            xAxis={[{
              label: isMobile ? '' : 'Gains (€)',
              labelStyle: { textAnchor: 'middle' },
              tickNumber: 5
            }]}
            series={[{
              data: sortedData.gains,
              valueFormatter: (value) => `${value?.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })}`
            }]}
            colors={sortedData.colors}
            slotProps={{
              bar: (item: any) => ({
                style: {
                  fill: sortedData.colors[item.dataIndex] || '#000000'
                }
              })
            }}
            height={300}
            margin={{
              top: 20,
              right: isMobile ? 20 : 80,
              bottom: isMobile ? 40 : 60,
              left: isMobile ? 10 : 120
            }}
            grid={{ horizontal: false, vertical: true }}
            layout="horizontal"
          />
        </Box>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Total Gains: {sortedData.totalGains?.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' }) || '€0'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;