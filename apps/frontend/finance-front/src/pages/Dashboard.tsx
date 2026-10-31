import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { AccountBalance } from '@mui/icons-material';
import { Link } from 'react-router';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { useDashboard } from '../hooks/useDashboard';
import NetWorthHero from '../components/NetWorthHero';
import SafetyCard from '../components/SafetyCard';
import InvestmentsSummaryCard from '../components/InvestmentsSummaryCard';
import PortfolioValueChart from '../components/PortfolioValueChart';
import AllocationCard from '../components/AllocationCard';
import CashflowCard from '../components/CashflowCard';
import { appPath } from '../appBase';

const Dashboard: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { data, isLoading, error } = useDashboard(tenantGroupId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Alert severity="error">{error.message || 'Failed to fetch dashboard data'}</Alert>
      </Box>
    );
  }

  const hasData = data && data.netWorthHistory.length > 0;
  const currency = data?.currency || 'EUR';

  return (
    // No side padding on a phone: the layout's container already has a gutter,
    // and the two together cost every card 32px of width.
    <Box sx={{ minHeight: '100vh', py: { xs: 1.5, md: 4 }, px: { xs: 0, md: 4 } }}>
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: { xs: 0.25, md: 1 }, fontSize: { xs: '1.4rem', md: '2.125rem' } }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: '0.875rem', md: '1rem' } }}>
          What you are worth, whether it is growing, and how long it would last
        </Typography>
      </Box>

      {hasData && (
        <>
          {/* Read top to bottom as the questions it answers: what am I worth and
              how did it get here, how long would it last, how has it moved,
              where is it, what has investing made. The first two share a row so
              nothing above the chart is mostly empty space. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: data.safety ? '3fr 2fr' : 'minmax(0, 1fr)' },
              gap: { xs: 2, md: 3 },
              mb: { xs: 2, md: 3 },
              alignItems: 'start'
            }}
          >
            <Box sx={{ display: 'grid', gap: { xs: 2, md: 3 }, minWidth: 0 }}>
              <NetWorthHero kpis={data.kpis} currency={currency} />
              {data.cashflow && <CashflowCard cashflow={data.cashflow} currency={currency} />}
            </Box>
            {data.safety && <SafetyCard safety={data.safety} currency={currency} />}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '2fr 1fr' },
              gap: { xs: 2, md: 3 },
              mb: { xs: 2, md: 3 },
              alignItems: 'stretch'
            }}
          >
            <PortfolioValueChart
              records={data.netWorthHistory.map((p) => ({
                date: p.date,
                totalValue: p.total,
                assetBreakdown: p.byClass
              }))}
              assetColors={data.assetColors}
            />
            <AllocationCard
              allocation={data.allocation}
              liabilities={data.liabilities}
              currency={currency}
            />
          </Box>

          {data.holdings && <InvestmentsSummaryCard holdings={data.holdings} currency={currency} />}
        </>
      )}

      {!hasData && (
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center', py: { xs: 3, md: 6 } }}
        >
          <CardContent>
            <AccountBalance sx={{ fontSize: { xs: 48, md: 64 }, color: '#cbd5e1', mb: 2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: 'text.secondary' }}>
              No data yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Add your first monthly check-in to see your net worth here.
            </Typography>
            <Button component={Link} to={appPath('/net-worth')} variant="contained">
              Go to Net Worth
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard;
