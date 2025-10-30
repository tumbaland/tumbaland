import React, { useMemo } from 'react';
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
import { useFinanceRecords } from '../hooks/useFinance';
import FinancialKPIs from '../components/FinancialKPIs';
import PortfolioValueChart from '../components/PortfolioValueChart';
import AssetAllocationChart from '../components/AssetAllocationChart';
import PerformanceChart from '../components/PerformanceChart';

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
  const tenantGroupId = useTenantFilter();

  // React Query hook for finance records
  const { data: records = [], isLoading, error } = useFinanceRecords(tenantGroupId);

  // Sort records for chronological display
  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a: FinanceRecord, b: FinanceRecord) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [records]);

  // Calculate portfolio summary
  const portfolioSummary = useMemo(() => {
    if (!sortedRecords || sortedRecords.length === 0) return null;

    const latest = sortedRecords[sortedRecords.length - 1];
    const previous = sortedRecords.length > 1 ? sortedRecords[sortedRecords.length - 2] : null;

    const totalValue = latest.secondPillar + latest.thirdPillar + latest.etfPortfolio + latest.cash + latest.gold;
    const totalGains = latest.secondPillarGain + latest.thirdPillarGain + latest.etfGain;
    const totalInvested = totalValue - totalGains;

    const previousValue = previous
      ? previous.secondPillar + previous.thirdPillar + previous.etfPortfolio + previous.cash + previous.gold
      : totalValue;
    const monthlyChange = totalValue - previousValue;
    const monthlyChangePercent = previousValue > 0 ? (monthlyChange / previousValue) * 100 : 0;

    const gainsPercentage = totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalGains,
      gainsPercentage,
      monthlyChange,
      monthlyChangePercent,
      breakdown: {
        secondPillar: latest.secondPillar,
        thirdPillar: latest.thirdPillar,
        etfPortfolio: latest.etfPortfolio,
        cash: latest.cash,
        gold: latest.gold
      },
      gains: {
        secondPillar: latest.secondPillarGain,
        thirdPillar: latest.thirdPillarGain,
        etfPortfolio: latest.etfGain
      }
    };
  }, [sortedRecords]);

  // Prepare performance data for BarChart
  const performanceData = useMemo(() => {
    if (!portfolioSummary) return { categories: [], gains: [], colors: [] };

    const categories = ['Second Pillar', 'Third Pillar', 'ETF Portfolio'];
    const gains = [
      portfolioSummary.gains.secondPillar,
      portfolioSummary.gains.thirdPillar,
      portfolioSummary.gains.etfPortfolio
    ];
    const colors = ['#667eea', '#764ba2', '#11998e'];

    return { categories, gains, colors };
  }, [portfolioSummary]);

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
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
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

      {portfolioSummary && (
        <>
          {/* Key Metrics Cards */}
          <FinancialKPIs
            data={{
              totalValue: portfolioSummary.totalValue,
              totalGains: portfolioSummary.totalGains,
              gainsPercentage: portfolioSummary.gainsPercentage,
              monthlyChange: portfolioSummary.monthlyChange,
              monthlyChangePercent: portfolioSummary.monthlyChangePercent
            }}
          />

          {/* Portfolio Timeline - Full Width */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
            <PortfolioValueChart records={sortedRecords} />
          </Box>

          {/* Asset Allocation and Performance Charts */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: { xs: 3, md: 4 } }}>
            {/* Asset Allocation */}
            <AssetAllocationChart
              data={portfolioSummary.breakdown}
              totalValue={portfolioSummary.totalValue}
            />

            {/* Performance by Asset */}
            <PerformanceChart data={performanceData} />
          </Box>
        </>
      )}

      {!portfolioSummary && !isLoading && (
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            textAlign: 'center',
            py: 6
          }}
        >
          <CardContent>
            <AccountBalance sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Financial Data Available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first finance record to see your portfolio dashboard
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard;
