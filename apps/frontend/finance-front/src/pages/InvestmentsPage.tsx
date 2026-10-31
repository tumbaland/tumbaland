import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { useHoldings, useClosedPositions } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { getMyEntitlements } from '../services/entitlementsService';
import { getGlobalConfig } from '../config/ConfigProvider';
import HoldingsTab from '../components/investments/HoldingsTab';
import ClosedPositionsSection from '../components/investments/ClosedPositionsSection';
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
  const { data: closedPositions = [] } = useClosedPositions(tenantGroupId);
  const { data: tickers = [], isLoading: tickersLoading } = useTrackedTickers(tenantGroupId);

  // Plan limits and live meter readings for the tracked-ticker bar. `retry:
  // false` and no error branch on purpose: the meter is decoration on a page
  // that works without it, so payment-service being down must not cost the user
  // their portfolio.
  const { data: entitlements } = useQuery({
    queryKey: ['myEntitlements'],
    queryFn: () => getMyEntitlements(),
    staleTime: 60 * 1000,
    retry: false
  });

  // The shell owns the URL and hosts each front in an iframe, so an upgrade
  // link navigates the *top* window to the shell's pricing route rather than
  // the embedded one.
  //
  // Config is read inside the handler, not at render: `getGlobalConfig` throws
  // when no provider has mounted, and a usage bar must never be the reason a
  // page fails to render.
  const goToPlans = React.useCallback(() => {
    let shellFrontUrl: string | undefined;
    try {
      shellFrontUrl = getGlobalConfig().SHELL_FRONT_URL;
    } catch {
      return;
    }
    if (shellFrontUrl && window.top?.location) window.top.location.href = `${shellFrontUrl}/payments`;
  }, []);

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
        <>
          <HoldingsTab holdings={holdings} tenantGroupId={tenantGroupId} notify={notify} />
          <ClosedPositionsSection positions={closedPositions} />
        </>
      ) : (
        <TickersTab
          tickers={tickers}
          tenantGroupId={tenantGroupId}
          notify={notify}
          tickerLimit={entitlements?.limits?.meters?.trackedTickers}
          meteredTickers={entitlements?.usage?.trackedTickers}
          onUpgrade={goToPlans}
        />
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
