import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, AlertTitle, Button, Tabs, Tab } from '@mui/material';
import { useTenantFilter } from '@tumbaland/components';
import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { usePersistedState } from '../hooks/usePersistedState';
import { getTickerPriceHistory } from '../services/tickerPriceHistoryService';
import { getGlobalConfig } from '../config/ConfigProvider';
import { FrontierSim, runFrontierSimulation } from '../utils/frontierSim';
import HoldingsTable, { HoldingStat } from '../components/planner/HoldingsTable';
import FrontierSection from '../components/planner/FrontierSection';
import ProjectionSection from '../components/planner/ProjectionSection';

const SIMULATIONS = 2000;
/** How far back to pull daily closes for the covariance estimate. */
const HISTORY_YEARS = 2;
/**
 * Below this much actual history the frontier is not worth computing.
 *
 * The server clips price history to the plan's retention window, so a free
 * account asking for two years receives ninety days. A covariance estimate off
 * ninety daily closes is not a weaker answer, it is a misleading one — and a
 * confidently wrong efficient frontier is worse than a locked feature. So the
 * page checks what it actually got rather than what it asked for, which also
 * covers the honest case of an instrument that simply has not been tracked long.
 */
const MIN_HISTORY_DAYS = 365;

// Merged replacement for the old Portfolio Optimizer + Stock Growth Calculator
// pages: the frontier simulation's return/volatility estimates feed the
// long-horizon growth projection instead of asking the user to guess them.
const PortfolioPlanner: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { data: holdings = [], isLoading: holdingsLoading } = useHoldings(tenantGroupId);
  const { data: trackedTickers = [] } = useTrackedTickers(tenantGroupId);

  const [pricesByTicker, setPricesByTicker] = useState<Record<string, number[]>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  /** Span of the longest series actually returned, in days. `null` until loaded. */
  const [historySpanDays, setHistorySpanDays] = useState<number | null>(null);
  const [riskFreeRate, setRiskFreeRate] = usePersistedState('finance-planner-risk-free-rate', '3'); // % per year
  const [tab, setTab] = useState(0);

  const nameByTicker = useMemo(() => {
    const m: Record<string, string> = {};
    trackedTickers.forEach(t => (m[t.ticker] = t.displayName));
    return m;
  }, [trackedTickers]);

  // Load price history for the held tickers only, grouped by ticker. The
  // simulation needs roughly the last two years of daily closes, so the range
  // is bounded too — the full collection is unbounded and mostly irrelevant here.
  useEffect(() => {
    if (holdings.length === 0) return;
    const portfolioTickers = [...new Set(holdings.map(p => p.ticker))];
    setLoadingPrices(true);
    setPriceError(null);

    const from = new Date();
    from.setFullYear(from.getFullYear() - HISTORY_YEARS);
    const fromDate = from.toISOString().slice(0, 10);

    Promise.all(
      portfolioTickers.map(ticker => getTickerPriceHistory({ ticker, from: fromDate }))
    )
      .then(perTicker => {
        const all = perTicker.flat();
        const rawMap: Record<string, { date: string; price: number }[]> = {};
        all
          .filter(d => d.price > 0)
          .forEach(d => {
            if (!rawMap[d.ticker]) rawMap[d.ticker] = [];
            rawMap[d.ticker].push({ date: d.date, price: d.price });
          });

        const sorted: Record<string, number[]> = {};
        let longestSpanDays = 0;
        Object.entries(rawMap).forEach(([ticker, entries]) => {
          const chronological = entries.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          const prices = chronological.map(e => e.price);
          if (prices.length >= 20) sorted[ticker] = prices;

          const oldest = new Date(chronological[0].date).getTime();
          const newest = new Date(chronological[chronological.length - 1].date).getTime();
          longestSpanDays = Math.max(longestSpanDays, (newest - oldest) / 86_400_000);
        });
        setPricesByTicker(sorted);
        setHistorySpanDays(Math.round(longestSpanDays));
      })
      .catch(() => setPriceError('Failed to load price history'))
      .finally(() => setLoadingPrices(false));
  }, [holdings]);

  // Frontier simulation — stored as state so results are stable across
  // re-renders. Re-runs only when price data loads or on explicit Re-run.
  const [sim, setSim] = useState<FrontierSim | null>(null);

  const runSim = () => {
    const quantityByTicker: Record<string, number> = {};
    holdings.forEach(h => (quantityByTicker[h.ticker] = h.quantity));
    setSim(
      runFrontierSimulation({
        pricesByTicker,
        quantityByTicker,
        riskFreeRatePct: parseFloat(riskFreeRate) || 0,
        simulations: SIMULATIONS
      })
    );
  };

  /**
   * Whether the returned series is long enough to estimate a covariance from.
   * `null` means "not loaded yet", which must not read as insufficient.
   */
  const hasEnoughHistory = historySpanDays === null || historySpanDays >= MIN_HISTORY_DAYS;

  // The shell owns the URL and embeds each front in an iframe, so an upgrade
  // link navigates the *top* window. Config is read inside the handler because
  // `getGlobalConfig` throws when no provider has mounted, and a paywall notice
  // must never be the reason this page fails to render.
  const goToPlans = React.useCallback(() => {
    let shellFrontUrl: string | undefined;
    try {
      shellFrontUrl = getGlobalConfig().SHELL_FRONT_URL;
    } catch {
      return;
    }
    if (shellFrontUrl && window.top?.location) window.top.location.href = `${shellFrontUrl}/payments`;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (Object.keys(pricesByTicker).length >= 2 && hasEnoughHistory) runSim();
  }, [pricesByTicker]);

  // Target risk level chosen by the user via slider — persisted so a returning
  // user's plan doesn't reset to Max Sharpe on every visit.
  const [targetVol, setTargetVol] = usePersistedState<number | null>('finance-planner-target-vol', null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sim && targetVol === null) setTargetVol(sim.maxSharpe.vol); }, [sim]);

  // Efficient frontier point at or below targetVol: highest return at that risk level
  const targetPortfolio = useMemo(() => {
    if (!sim) return null;
    const vol = targetVol ?? sim.maxSharpe.vol;
    const candidates = sim.points.filter(p => p.vol <= vol);
    if (candidates.length === 0) return sim.minVol;
    return candidates.reduce((b, p) => (p.ret > b.ret ? p : b));
  }, [sim, targetVol]);

  // Per-holding performance stats
  const holdingStats = useMemo<HoldingStat[]>(() => {
    return holdings
      .map(p => {
        const prices = pricesByTicker[p.ticker];
        const latestPrice = prices ? prices[prices.length - 1] : null;
        const returnPct = latestPrice != null
          ? ((latestPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100
          : null;
        const currentValue = latestPrice != null ? latestPrice * p.quantity : null;
        return { ...p, latestPrice, returnPct, currentValue };
      })
      .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  }, [holdings, pricesByTicker]);

  const totalValue = holdingStats.reduce((s, h) => s + (h.currentValue ?? 0), 0);

  const isLoading = holdingsLoading || loadingPrices;

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const tickersWithoutData = holdings.map(p => p.ticker).filter(t => !pricesByTicker[t]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Portfolio Planner</Typography>
      {priceError && <Alert severity="error" sx={{ mb: 2 }}>{priceError}</Alert>}
      {holdings.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add holdings in the Investments page to optimize your allocation — until then the
          projection below runs on manual assumptions.
        </Alert>
      )}
      {tickersWithoutData.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No price history for: {tickersWithoutData.join(', ')}. Fetch data in Tracked Tickers first.
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Holdings" />
        <Tab label="Frontier" />
        <Tab label="Projection" />
      </Tabs>

      {/* Panels stay mounted (just hidden) so switching tabs never re-fetches or
          resets in-progress input — only one is visible at a time. */}
      <Box role="tabpanel" hidden={tab !== 0}>
        {holdings.length > 0 && (
          <HoldingsTable holdings={holdingStats} nameByTicker={nameByTicker} totalValue={totalValue} />
        )}
      </Box>

      <Box role="tabpanel" hidden={tab !== 1}>
        {sim ? (
          <FrontierSection
            sim={sim}
            targetPortfolio={targetPortfolio}
            targetVol={targetVol}
            onTargetVolChange={setTargetVol}
            riskFreeRate={riskFreeRate}
            onRiskFreeRateChange={setRiskFreeRate}
            onRerun={runSim}
            totalValue={totalValue}
            nameByTicker={nameByTicker}
            simulations={SIMULATIONS}
          />
        ) : holdings.length > 0 && !hasEnoughHistory ? (
          /*
            Deliberately not a frontier computed from what little came back. The
            server clips price history to the plan's retention window, so a free
            account asking for two years receives ninety days — and a covariance
            estimate off ninety closes produces a confident, wrong answer. Say
            what is missing and why instead.
          */
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={goToPlans}>
                See plans
              </Button>
            }
          >
            <AlertTitle>Not enough price history to plan with</AlertTitle>
            The efficient frontier needs about {HISTORY_YEARS} years of daily closes to estimate how
            your holdings move together. Your history reaches back {historySpanDays} days, so a
            frontier computed from it would be confidently wrong rather than merely rough — which is
            why it is not shown.
            <br />
            <br />
            Plans with full history keep every close ever fetched. If you have only tracked these
            instruments recently, the range will also fill in on its own.
          </Alert>
        ) : (
          holdings.length > 0 && Object.keys(pricesByTicker).length < 2 && (
            <Alert severity="info">
              Need price history for at least 2 holdings to run the optimizer.
              Open each ticker in Tracked Tickers and fetch its historical data first.
            </Alert>
          )
        )}
      </Box>

      <Box role="tabpanel" hidden={tab !== 2}>
        <ProjectionSection sim={sim} targetPortfolio={targetPortfolio} portfolioValue={totalValue} />
      </Box>
    </Box>
  );
};

export default PortfolioPlanner;
