import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance
} from '@mui/icons-material';
import { useTenantFilter } from '../components/tenant';
import { useFinanceRecords } from '../hooks/useFinance';
import AssetDonutChart from '../components/AssetDonutChart';
import AssetPerformanceChart from '../components/AssetPerformanceChart';

interface FinanceRecord {
  _id: string;
  date: string;
  secondPillar: number;
  secondPillarGain: number;
  thirdPillar: number;
  thirdPillarGain: number;
  etfPortfolio: number;
  etfGain: number;
  cash: number;
  gold: number;
}

const Dashboard: React.FC = () => {
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context

  // React Query hook for finance records
  const { data: records = [], isLoading, error } = useFinanceRecords(tenantGroupId);

  // Sort records for the chart (most recent first)
  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a: FinanceRecord, b: FinanceRecord) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [records]);

  // Calculate portfolio summary using useMemo for performance
  const portfolioSummary = useMemo(() => {
    if (!sortedRecords || sortedRecords.length === 0) return null;

    const latest = sortedRecords[0];
    const totalValue = latest.secondPillar + latest.thirdPillar + latest.etfPortfolio + latest.cash + latest.gold;
    const totalGains = latest.secondPillarGain + latest.thirdPillarGain + latest.etfGain;
    const totalInvested = totalValue - totalGains;
    const gainsPercentage = totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalGains,
      gainsPercentage,
      breakdown: {
        secondPillar: latest.secondPillar,
        thirdPillar: latest.thirdPillar,
        etfPortfolio: latest.etfPortfolio,
        cash: latest.cash,
        gold: latest.gold
      }
    };
  }, [sortedRecords]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error.message || 'Failed to fetch finance records'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      py: { xs: 2, md: 4 },
      px: { xs: 2, md: 4 }
    }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 1, md: 2 } }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: '#2c3e50',
            textAlign: { xs: 'center', md: 'left' }
          }}
        >
          Finance
        </Typography>
      </Box>

      {portfolioSummary && (
        <>
          {/* Key Metrics Card */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <AccountBalance sx={{ mr: 2, fontSize: { xs: 32, md: 36 } }} />
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                      Total Portfolio
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      Value & Performance
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 4 }, alignItems: 'center' }}>
                  {/* Total Value */}
                  <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, flex: 1 }}>
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '2rem', md: '2.5rem' } }}>
                      {formatCurrency(portfolioSummary.totalValue)}
                    </Typography>
                  </Box>

                  {/* Gains */}
                  <Box sx={{ textAlign: { xs: 'center', sm: 'right' }, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-end' }, mb: 1 }}>
                      {portfolioSummary.totalGains >= 0 ? (
                        <TrendingUp sx={{ mr: 1, fontSize: 24 }} />
                      ) : (
                        <TrendingDown sx={{ mr: 1, fontSize: 24 }} />
                      )}
                      <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' } }}>
                        {formatCurrency(portfolioSummary.totalGains)}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${portfolioSummary.gainsPercentage >= 0 ? '+' : ''}${portfolioSummary.gainsPercentage.toFixed(2)}%`}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        px: 2,
                        py: 0.5
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Charts Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
            {/* Donut Chart */}
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
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    color: '#2c3e50',
                    textAlign: 'center',
                    mb: 2
                  }}
                >
                  Asset Allocation
                </Typography>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 300
                }}>
                  <AssetDonutChart
                    data={portfolioSummary.breakdown}
                    totalValue={portfolioSummary.totalValue}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Asset Performance Chart */}
            <AssetPerformanceChart records={sortedRecords} />
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dashboard;
