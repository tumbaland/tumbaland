import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, useMediaQuery, useTheme } from '@mui/material';
import { PieChart as PieChartIcon } from '@mui/icons-material';
import { PieChart } from '@mui/x-charts';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency } from '../utils/numberUtils';

interface AllocationCardProps {
  allocation: DashboardData['allocation'];
  liabilities?: DashboardData['liabilities'];
  currency?: string;
}

const rowTextSx = { fontSize: { xs: '0.8rem', md: '0.875rem' } };

/**
 * Where the latest net worth sits: donut + per-class bars.
 *
 * The donut covers assets only — a negative slice has no meaning in a pie, and
 * percentages are shares of gross assets — with debts listed separately below.
 */
const AllocationCard: React.FC<AllocationCardProps> = ({
  allocation,
  liabilities = [],
  currency = 'EUR'
}) => {
  // A smaller donut on a phone: the rows under it carry the exact figures, so
  // at full size it only pushed them a screen further down.
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const donutSize = isPhone ? 150 : 180;

  if (allocation.length === 0 && liabilities.length === 0) return null;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 3 } }}>
          <PieChartIcon sx={{ mr: { xs: 1, md: 2 }, color: '#667eea', fontSize: { xs: 20, md: 24 } }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
            Asset Allocation
          </Typography>
        </Box>

        {allocation.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 1.5, md: 3 } }}>
          <PieChart
            series={[{
              data: allocation.map((a) => ({ id: a.assetClassId, value: a.value, label: a.name, color: a.color })),
              innerRadius: isPhone ? 42 : 52,
              paddingAngle: 1,
              cornerRadius: 3
            }]}
            height={donutSize}
            width={donutSize}
            hideLegend
          />
        </Box>
        )}

        {allocation.map((a) => (
          <Box key={a.assetClassId} sx={{ mb: { xs: 1, md: 1.25 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: a.color, flexShrink: 0 }} />
                <Typography variant="body2" noWrap sx={rowTextSx}>{a.name}</Typography>
              </Box>
              <Typography variant="body2" sx={{ ...rowTextSx, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {formatCurrency(a.value, currency)} · {a.percentage.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={a.percentage}
              sx={{
                height: { xs: 5, md: 6 },
                borderRadius: 3,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: a.color, borderRadius: 3 }
              }}
            />
          </Box>
        ))}

        {liabilities.length > 0 && (
          <Box sx={{ mt: { xs: 1.5, md: 3 }, pt: { xs: 1.5, md: 2 }, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: { xs: 1, md: 1.5 } }}>
              Liabilities
            </Typography>
            {liabilities.map((l) => (
              <Box key={l.assetClassId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color, flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={rowTextSx}>{l.name}</Typography>
                </Box>
                <Typography variant="body2" sx={{ ...rowTextSx, fontWeight: 600, color: 'error.main', whiteSpace: 'nowrap' }}>
                  −{formatCurrency(l.value, currency)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AllocationCard;
