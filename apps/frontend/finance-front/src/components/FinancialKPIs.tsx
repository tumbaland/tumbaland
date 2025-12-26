import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  alpha
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance
} from '@mui/icons-material';
import { Chip } from '@mui/material';

interface FinancialKPIsData {
  totalValue: number;
  totalGains: number;
  gainsPercentage: number;
  monthlyChange: number;
  monthlyChangePercent: number;
}

interface FinancialKPIsProps {
  data: FinancialKPIsData;
}

const FinancialKPIs: React.FC<FinancialKPIsProps> = ({ data }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 3 }, mb: { xs: 3, md: 4 } }}>
      {/* Total Portfolio Value */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 4px 20px ${alpha('#667eea', 0.15)}`,
            borderColor: alpha('#667eea', 0.5)
          }
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha('#667eea', 0.1),
                color: '#667eea',
                mr: 2,
                display: 'flex'
              }}
            >
              <AccountBalance sx={{ fontSize: { xs: 24, md: 28 } }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Total Portfolio
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Current Value
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' }, color: 'text.primary' }}>
            {formatCurrency(data.totalValue)}
          </Typography>
        </CardContent>
      </Card>

      {/* Total Gains */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 4px 20px ${alpha('#11998e', 0.15)}`,
            borderColor: alpha('#11998e', 0.5)
          }
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha('#11998e', 0.1),
                color: '#11998e',
                mr: 2,
                display: 'flex'
              }}
            >
              <TrendingUp sx={{ fontSize: { xs: 24, md: 28 } }} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Total Gains
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Unrealized Profits
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' }, color: 'text.primary' }}>
            {formatCurrency(data.totalGains)}
          </Typography>
          <Chip
            label={`${data.gainsPercentage >= 0 ? '+' : ''}${data.gainsPercentage.toFixed(1)}%`}
            sx={{
              bgcolor: alpha('#11998e', 0.1),
              color: '#11998e',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        </CardContent>
      </Card>

      {/* Monthly Change */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 4px 20px ${alpha(data.monthlyChange >= 0 ? '#22c55e' : '#ef4444', 0.15)}`,
            borderColor: alpha(data.monthlyChange >= 0 ? '#22c55e' : '#ef4444', 0.5)
          }
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(data.monthlyChange >= 0 ? '#22c55e' : '#ef4444', 0.1),
                color: data.monthlyChange >= 0 ? '#22c55e' : '#ef4444',
                mr: 2,
                display: 'flex'
              }}
            >
              {data.monthlyChange >= 0 ? (
                <TrendingUp sx={{ fontSize: { xs: 24, md: 28 } }} />
              ) : (
                <TrendingDown sx={{ fontSize: { xs: 24, md: 28 } }} />
              )}
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Monthly Change
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Latest Performance
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' }, color: 'text.primary' }}>
            {formatCurrency(data.monthlyChange)}
          </Typography>
          <Chip
            label={`${data.monthlyChangePercent >= 0 ? '+' : ''}${data.monthlyChangePercent.toFixed(1)}%`}
            sx={{
              bgcolor: alpha(data.monthlyChange >= 0 ? '#22c55e' : '#ef4444', 0.1),
              color: data.monthlyChange >= 0 ? '#22c55e' : '#ef4444',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default FinancialKPIs;