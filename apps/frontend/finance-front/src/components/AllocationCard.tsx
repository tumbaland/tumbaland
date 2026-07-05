import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { PieChart as PieChartIcon } from '@mui/icons-material';
import { PieChart } from '@mui/x-charts';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency } from '../utils/numberUtils';

interface AllocationCardProps {
  allocation: DashboardData['allocation'];
}

/** Where the latest net worth sits: donut + per-class bars. */
const AllocationCard: React.FC<AllocationCardProps> = ({ allocation }) => {
  if (allocation.length === 0) return null;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <PieChartIcon sx={{ mr: 2, color: '#667eea' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Asset Allocation
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <PieChart
            series={[{
              data: allocation.map((a) => ({ id: a.assetClassId, value: a.value, label: a.name, color: a.color })),
              innerRadius: 60,
              paddingAngle: 1,
              cornerRadius: 3
            }]}
            height={220}
            width={220}
            hideLegend
          />
        </Box>

        {allocation.map((a) => (
          <Box key={a.assetClassId} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: a.color }} />
                <Typography variant="body2">{a.name}</Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCurrency(a.value)} · {a.percentage.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={a.percentage}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: a.color, borderRadius: 3 }
              }}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};

export default AllocationCard;
