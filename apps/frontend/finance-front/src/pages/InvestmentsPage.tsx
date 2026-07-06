import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useTenantFilter } from '@tumbaland/components';
import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import HoldingsTab from '../components/investments/HoldingsTab';
import TickersTab from '../components/investments/TickersTab';

/**
 * Everything market-traded in one place: your positions (holdings) and the
 * instruments whose prices are collected daily (tracked tickers).
 */
const InvestmentsPage: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const { data: holdings = [], isLoading: holdingsLoading } = useHoldings(tenantGroupId);
  const { data: tickers = [], isLoading: tickersLoading } = useTrackedTickers(tenantGroupId);

  const notify = (message: string, severity: 'success' | 'error') => setSnackbar({ message, severity });

  const loading = tab === 0 ? holdingsLoading : tickersLoading;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Investments</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Your ETF and stock positions with live prices
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`Holdings (${holdings.length})`} />
        <Tab label={`Tracked tickers (${tickers.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : tab === 0 ? (
        <HoldingsTab holdings={holdings} tenantGroupId={tenantGroupId} notify={notify} />
      ) : (
        <TickersTab tickers={tickers} tenantGroupId={tenantGroupId} notify={notify} />
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity || 'success'} onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InvestmentsPage;
