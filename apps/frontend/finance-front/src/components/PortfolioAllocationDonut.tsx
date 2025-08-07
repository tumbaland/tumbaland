import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { PieChart } from '@mui/icons-material';

interface PortfolioAllocationDonutProps {
  allocation: Record<string, number>;
  totalAmount: number;
}

const PortfolioAllocationDonut: React.FC<PortfolioAllocationDonutProps> = ({
  allocation,
  totalAmount
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getPercentage = (amount: number) => {
    return totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : '0.0';
  };

  const allocationData = Object.entries(allocation)
    .filter(([_, amount]) => amount > 0)
    .sort(([_, a], [__, b]) => b - a);

  if (allocationData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <PieChart sx={{ mr: 1 }} />
            Portfolio Allocation
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No allocation data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Color palette for different assets
  const colors = [
    '#1976d2', '#2e7d32', '#d32f2f', '#f57c00', '#7b1fa2',
    '#0097a7', '#5d4037', '#455a64', '#e91e63', '#3f51b5'
  ];

  const size = 250;
  const center = size / 2;
  const radius = 80;
  const innerRadius = 40;

  let cumulativePercentage = 0;

  const createArcPath = (startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) => {
    const start = polarToCartesian(center, center, outerRadius, endAngle);
    const end = polarToCartesian(center, center, outerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    const outerPath = [
      "M", start.x, start.y,
      "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");

    const innerStart = polarToCartesian(center, center, innerRadius, endAngle);
    const innerEnd = polarToCartesian(center, center, innerRadius, startAngle);

    const innerPath = [
      "L", innerEnd.x, innerEnd.y,
      "A", innerRadius, innerRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y
    ].join(" ");

    return outerPath + innerPath + " Z";
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <PieChart sx={{ mr: 1 }} />
          Portfolio Allocation
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 3 }}>
          {/* Donut Chart */}
          <Box sx={{ flex: '0 0 auto' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {allocationData.map(([ticker, amount], index) => {
                const percentage = (amount / totalAmount) * 100;
                const startAngle = (cumulativePercentage / 100) * 360;
                const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
                
                cumulativePercentage += percentage;
                
                const arcPath = createArcPath(startAngle, endAngle, radius, innerRadius);
                
                return (
                  <path
                    key={ticker}
                    d={arcPath}
                    fill={colors[index % colors.length]}
                    stroke="white"
                    strokeWidth="2"
                  >
                    <title>{`${ticker}: ${formatCurrency(amount)} (${percentage.toFixed(1)}%)`}</title>
                  </path>
                );
              })}
              
              {/* Center text */}
              <text x={center} y={center - 8} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#666">
                Total
              </text>
              <text x={center} y={center + 8} textAnchor="middle" fontSize="12" fill="#666">
                {formatCurrency(totalAmount)}
              </text>
            </svg>
          </Box>

          {/* Legend */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {allocationData.map(([ticker, amount], index) => (
                <Box
                  key={ticker}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    borderLeft: `4px solid ${colors[index % colors.length]}`
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: colors[index % colors.length],
                        borderRadius: '50%',
                        mr: 1
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {ticker}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {formatCurrency(amount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getPercentage(amount)}%
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Summary */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                Diversification Summary
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Number of Assets:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {allocationData.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Largest Position:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {getPercentage(allocationData[0][1])}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PortfolioAllocationDonut;
