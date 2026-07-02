import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { PieChart as PieChartIcon } from '@mui/icons-material';
import { PieChart } from '@mui/x-charts';

interface AssetAllocationItem {
  assetClass: string;
  percentage: number;
  value: number;
}

interface AssetAllocationChartProps {
  data: AssetAllocationItem[];
  totalValue: number;
}

const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ data, totalValue }) => {
  // Prepare asset allocation data for PieChart
  const assetAllocationData = React.useMemo(() => {
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#06b6d4', '#f59e0b', '#ec4899'];

    return data.map((item, index) => ({
      id: item.assetClass,
      label: item.assetClass,
      value: item.value,
      color: colors[index % colors.length]
    })).filter(asset => asset.value > 0);
  }, [data]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (totalValue === 0) {
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
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <PieChartIcon sx={{ mr: 2, color: '#11998e' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Asset Allocation
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" sx={{
              color: "text.secondary"
            }}>
              No data available to display asset allocation
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
        border: '1px solid rgba(255,255,255,0.2)',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <PieChartIcon sx={{ mr: 2, color: '#11998e' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Asset Allocation
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
          <PieChart
            series={[{
              data: assetAllocationData,
              innerRadius: 60,
              outerRadius: 120,
              paddingAngle: 2,
              cornerRadius: 4
            }]}
            height={300}
            width={300}
            margin={{ top: 20, bottom: 20, left: 20, right: 20 }}
            slotProps={{
              legend: {
                direction: 'vertical',
                position: { vertical: 'bottom', horizontal: 'center' }
              }
            }}
          />
        </Box>
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Total: {formatCurrency(totalValue)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AssetAllocationChart;