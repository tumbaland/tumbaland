import React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { AccountBalance, ArrowForward, ShowChart } from '@mui/icons-material';
import { Link } from 'react-router';
import { useTenantFilter } from '@tumbaland/components';
import { useDashboard } from '../hooks/useDashboard';
import FinancialKPIs from '../components/FinancialKPIs';
import PortfolioValueChart from '../components/PortfolioValueChart';
import AllocationCard from '../components/AllocationCard';
import CashflowCard from '../components/CashflowCard';
import { formatCurrency, formatPct } from '../utils/numberUtils';
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
          Your net worth, asset allocation and investments at a glance
        </Typography>
      </Box>

      {hasData && (
        <>
          <FinancialKPIs kpis={data.kpis} currency={currency} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '2fr 1fr' },
              gap: { xs: 2, md: 4 },
              mb: { xs: 2, md: 4 },
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
            <Box sx={{ mb: { xs: 2, md: 4 } }}>
              <CashflowCard cashflow={data.cashflow} currency={currency} />
            </Box>
          )}

          {data.holdings && (
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
                {/* One grid, two arrangements: on a phone the title and the link
                    share the first line and the two figures sit side by side
                    under it; wider, everything is a single row. */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) auto auto' },
                    gridTemplateAreas: { xs: '"title link" "figures figures"', md: '"title figures link"' },
                    alignItems: 'center',
                    columnGap: { xs: 1.5, md: 4 },
                    rowGap: 1.5
                  }}
                >
                  <Box sx={{ gridArea: 'title', display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, minWidth: 0 }}>
                    <ShowChart sx={{ color: '#667eea', fontSize: { xs: 20, md: 24 } }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
                      Investments · {data.holdings.count} holding{data.holdings.count === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                  <Box sx={{ gridArea: 'figures', display: 'flex', gap: { xs: 2, md: 4 } }}>
                    <Box sx={{ flex: { xs: 1, md: 'none' } }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Market value</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
                        {formatCurrency(data.holdings.totalValue, currency)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: { xs: 1, md: 'none' } }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Unrealized P/L</Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: '1.05rem', md: '1.25rem' },
                          color: data.holdings.gain >= 0 ? 'success.main' : 'error.main'
                        }}
                      >
                        {data.holdings.gain >= 0 ? '+' : ''}{formatCurrency(data.holdings.gain, currency)}{' '}
                        <Box component="span" sx={{ fontSize: '0.8em', whiteSpace: 'nowrap' }}>
                          ({formatPct(data.holdings.gainPct)})
                        </Box>
                      </Typography>
                    </Box>
                  </Box>
                  {/* Just the arrow on a phone, like the Cash Flow card's link:
                      with the words the title no longer fit on its line. */}
                  <Button
                    component={Link}
                    to={appPath('/investments')}
                    size="small"
                    aria-label="View holdings"
                    endIcon={<ArrowForward />}
                    sx={{
                      gridArea: 'link',
                      justifySelf: 'end',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      '& .MuiButton-endIcon': { ml: { xs: 0, md: 1 } }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                      View holdings
                    </Box>
                  </Button>
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
