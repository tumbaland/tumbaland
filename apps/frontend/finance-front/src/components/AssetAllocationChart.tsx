import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { PieChart as PieChartIcon } from '@mui/icons-material';
import { PieChart } from '@mui/x-charts';

interface AssetAllocationData {
  secondPillar: number;
  thirdPillar: number;
  etfPortfolio: number;
  cash: number;
  gold: number;
}

interface AssetAllocationChartProps {
  data: AssetAllocationData;
  totalValue: number;
}

const AssetAllocationChart: React.FC<AssetAllocationChartProps> = ({ data, totalValue }) => {
  // Prepare asset allocation data for PieChart
  const assetAllocationData = React.useMemo(() => {
    const assets = [
      { id: 'secondPillar', label: 'Second Pillar', value: data.secondPillar, color: '#3b82f6' },
      { id: 'thirdPillar', label: 'Third Pillar', value: data.thirdPillar, color: '#1d4ed8' },
      { id: 'etfPortfolio', label: 'ETF Portfolio', value: data.etfPortfolio, color: '#ef4444' },
      { id: 'cash', label: 'Cash', value: data.cash, color: '#22c55e' },
      { id: 'gold', label: 'Gold', value: data.gold, color: '#eab308' }
    ].filter(asset => asset.value > 0);

    return assets;
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
            <Typography variant="body1" color="text.secondary">
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
          <Typography variant="body2" color="text.secondary">
            Total: {formatCurrency(totalValue)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AssetAllocationChart;