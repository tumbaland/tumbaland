import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { AccountBalance, ShowChart } from '@mui/icons-material';
import { Link } from 'react-router';
import { useTenantFilter } from '@tumbaland/components';
import { useDashboard } from '../hooks/useDashboard';
import FinancialKPIs from '../components/FinancialKPIs';
import PortfolioValueChart from '../components/PortfolioValueChart';
import AllocationCard from '../components/AllocationCard';
import CashflowCard from '../components/CashflowCard';
import { formatCurrency, formatPct } from '../utils/numberUtils';

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
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error.message || 'Failed to fetch dashboard data'}</Alert>
      </Box>
    );
  }

  const hasData = data && data.netWorthHistory.length > 0;
  const currency = data?.currency || 'EUR';

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 4 }, px: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Your net worth, asset allocation and investments at a glance
        </Typography>
      </Box>

      {hasData && (
        <>
          <FinancialKPIs kpis={data.kpis} currency={currency} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
              gap: { xs: 3, md: 4 },
              mb: { xs: 3, md: 4 },
              alignItems: 'start'
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

          {data.cashflow && (
            <Box sx={{ mb: { xs: 3, md: 4 } }}>
              <CashflowCard cashflow={data.cashflow} currency={currency} />
            </Box>
          )}

          {data.holdings && (
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ShowChart sx={{ mr: 2, color: '#667eea' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Investments · {data.holdings.count} holding{data.holdings.count === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Market value</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatCurrency(data.holdings.totalValue, currency)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Unrealized P/L</Typography>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: data.holdings.gain >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {data.holdings.gain >= 0 ? '+' : ''}{formatCurrency(data.holdings.gain, currency)} ({formatPct(data.holdings.gainPct)})
                      </Typography>
                    </Box>
                    <Button component={Link} to="/investments" variant="outlined" size="small">
                      View holdings
                    </Button>
                  </Box>
                </Box>
                {data.holdings.unconverted > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {data.holdings.unconverted} holding{data.holdings.unconverted === 1 ? ' is' : 's are'} quoted
                    in a currency with no exchange rate yet, so they are not included in these totals.
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!hasData && (
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center', py: 6 }}
        >
          <CardContent>
            <AccountBalance sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: 'text.secondary' }}>
              No data yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Add your first monthly check-in to see your net worth here.
            </Typography>
            <Button component={Link} to="/net-worth" variant="contained">
              Go to Net Worth
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard;
