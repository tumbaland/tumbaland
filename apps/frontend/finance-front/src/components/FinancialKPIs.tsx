import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box
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
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)'
          }
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AccountBalance sx={{ mr: 2, fontSize: { xs: 28, md: 32 } }} />
            <Box>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                Total Portfolio
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Current Value
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
            {formatCurrency(data.totalValue)}
          </Typography>
        </CardContent>
      </Card>

      {/* Total Gains */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(17, 153, 142, 0.3)',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(17, 153, 142, 0.4)'
          }
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TrendingUp sx={{ mr: 2, fontSize: { xs: 28, md: 32 } }} />
            <Box>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                Total Gains
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Unrealized Profits
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
            {formatCurrency(data.totalGains)}
          </Typography>
          <Chip
            label={`${data.gainsPercentage >= 0 ? '+' : ''}${data.gainsPercentage.toFixed(1)}%`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        </CardContent>
      </Card>

      {/* Monthly Change */}
      <Card
        sx={{
          background: data.monthlyChange >= 0
            ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)'
            : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
          color: 'white',
          borderRadius: 3,
          boxShadow: data.monthlyChange >= 0
            ? '0 8px 32px rgba(74, 222, 128, 0.3)'
            : '0 8px 32px rgba(248, 113, 113, 0.3)',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: data.monthlyChange >= 0
              ? '0 12px 40px rgba(74, 222, 128, 0.4)'
              : '0 12px 40px rgba(248, 113, 113, 0.4)'
          }
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {data.monthlyChange >= 0 ? (
              <TrendingUp sx={{ mr: 2, fontSize: { xs: 28, md: 32 } }} />
            ) : (
              <TrendingDown sx={{ mr: 2, fontSize: { xs: 28, md: 32 } }} />
            )}
            <Box>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                Monthly Change
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Latest Performance
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
            {formatCurrency(data.monthlyChange)}
          </Typography>
          <Chip
            label={`${data.monthlyChangePercent >= 0 ? '+' : ''}${data.monthlyChangePercent.toFixed(1)}%`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
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