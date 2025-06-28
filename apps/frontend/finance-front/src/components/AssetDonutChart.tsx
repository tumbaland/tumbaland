import React, { useState } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { PieChart } from '@mui/icons-material';

interface AssetAllocationData {
  secondPillar: number;
  thirdPillar: number;
  etfPortfolio: number;
  cash: number;
  gold: number;
}

interface DonutChartProps {
  data: AssetAllocationData;
  totalValue: number;
}

const AssetDonutChart: React.FC<DonutChartProps> = ({ data, totalValue }) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPercentage = (value: number) => {
    return totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
  };

  const assetClasses = [
    { key: 'secondPillar', label: 'Second Pillar', value: data.secondPillar, color: '#667eea' },
    { key: 'thirdPillar', label: 'Third Pillar', value: data.thirdPillar, color: '#764ba2' },
    { key: 'etfPortfolio', label: 'ETF Portfolio', value: data.etfPortfolio, color: '#11998e' },
    { key: 'cash', label: 'Cash', value: data.cash, color: '#38ef7d' },
    { key: 'gold', label: 'Gold', value: data.gold, color: '#ffd700' },
  ].filter(asset => asset.value > 0); // Only show assets with values

  if (totalValue === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <PieChart sx={{ mr: 1 }} />
            Asset Allocation
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const size = 200;
  const strokeWidth = 40;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercentage = 0;

  const createSegment = (asset: typeof assetClasses[0]) => {
    const percentage = (asset.value / totalValue) * 100;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercentage * circumference / 100;
    
    cumulativePercentage += percentage;

    const isHovered = hoveredSegment === asset.key;
    const adjustedStrokeWidth = isHovered ? strokeWidth + 4 : strokeWidth;
    const adjustedRadius = isHovered ? radius - 2 : radius;

    return (
      <circle
        key={asset.key}
        cx={size / 2}
        cy={size / 2}
        r={adjustedRadius}
        fill="transparent"
        stroke={asset.color}
        strokeWidth={adjustedStrokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: `${size / 2}px ${size / 2}px`,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          filter: isHovered ? 'brightness(1.1)' : 'none',
        }}
        onMouseEnter={() => setHoveredSegment(asset.key)}
        onMouseLeave={() => setHoveredSegment(null)}
      >
        <title>
          {asset.label}: {formatCurrency(asset.value)} ({getPercentage(asset.value)}%)
        </title>
      </circle>
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <PieChart sx={{ mr: 1 }} />
          Asset Allocation
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 3 }}>
          {/* Donut Chart */}
          <Box sx={{ position: 'relative' }}>
            <svg width={size} height={size} style={{ transform: 'rotate(0deg)' }}>
              {assetClasses.map(createSegment)}
            </svg>
            
            {/* Center content */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                maxWidth: '60%',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Total
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                {formatCurrency(totalValue)}
              </Typography>
            </Box>
          </Box>

          {/* Legend */}
          <Box sx={{ flexGrow: 1, minWidth: 120, maxWidth: 180 }}>
            {assetClasses.map((asset) => (
              <Box
                key={asset.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                  p: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: hoveredSegment === asset.key ? 'grey.50' : 'transparent',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={() => setHoveredSegment(asset.key)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    bgcolor: asset.color,
                    borderRadius: '50%',
                    mr: 1,
                    flexShrink: 0,
                    border: hoveredSegment === asset.key ? '2px solid rgba(0,0,0,0.2)' : 'none',
                    transform: hoveredSegment === asset.key ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                  }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', fontSize: '0.75rem' }} noWrap>
                    {asset.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
                    {formatCurrency(asset.value)}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 'bold',
                    color: asset.color,
                    fontSize: '0.75rem',
                    minWidth: 'fit-content',
                  }}
                >
                  {getPercentage(asset.value)}%
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Summary */}
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Portfolio distributed across {assetClasses.length} asset classes
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AssetDonutChart;
