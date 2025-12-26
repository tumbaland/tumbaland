import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { AccountBalance } from '@mui/icons-material';
import { useTenantFilter } from '../components/tenant';
import { useDashboard } from '../hooks/useDashboard';
import FinancialKPIs from '../components/FinancialKPIs';
import PortfolioValueChart from '../components/PortfolioValueChart';

const Dashboard: React.FC = () => {
  const tenantGroupId = useTenantFilter();

  // Use new dashboard hook
  const { data: dashboardData, isLoading, error } = useDashboard(tenantGroupId);

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
        <Alert severity="error">{error.message || 'Failed to fetch dashboard data'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      py: { xs: 2, md: 4 },
      px: { xs: 2, md: 4 }
    }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: '#1e293b',
            textAlign: { xs: 'center', md: 'left' },
            mb: 1
          }}
        >
          Financial Dashboard
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: '#64748b',
            textAlign: { xs: 'center', md: 'left' }
          }}
        >
          Track your investment portfolio performance and asset allocation
        </Typography>
      </Box>

      {dashboardData && (
        <>
          {/* Key Metrics Cards */}
          <FinancialKPIs
            data={{
              totalValue: dashboardData.kpis.totalPortfolioValue,
              totalGains: dashboardData.kpis.totalGains,
              gainsPercentage: dashboardData.kpis.totalGainsPercentage,
              monthlyChange: dashboardData.kpis.monthlyChange,
              monthlyChangePercent: dashboardData.kpis.monthlyChangePercentage
            }}
          />

          {/* Portfolio Timeline - Full Width */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
            <PortfolioValueChart
              records={dashboardData.portfolioHistory}
              assetColors={dashboardData.assetAllocation.reduce((acc, allocation) => {
                acc[allocation.assetClass] = allocation.color || '#667eea';
                return acc;
              }, {} as { [key: string]: string })}
            />
          </Box>
        </>
      )}

      {!dashboardData && !isLoading && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
            py: 6
          }}
        >
          <CardContent>
            <AccountBalance sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Portfolio Data Available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first portfolio holdings to see your dashboard
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard;
