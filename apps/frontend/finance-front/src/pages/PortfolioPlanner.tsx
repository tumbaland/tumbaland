import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useTenantFilter } from '@tumbaland/components';
import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { getTickerPriceHistory } from '../services/tickerPriceHistoryService';
import { FrontierSim, runFrontierSimulation } from '../utils/frontierSim';
import HoldingsTable, { HoldingStat } from '../components/planner/HoldingsTable';
import FrontierSection from '../components/planner/FrontierSection';
import ProjectionSection from '../components/planner/ProjectionSection';

const SIMULATIONS = 2000;

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
  const [riskFreeRate, setRiskFreeRate] = useState('3'); // % per year

  const nameByTicker = useMemo(() => {
    const m: Record<string, string> = {};
    trackedTickers.forEach(t => (m[t.ticker] = t.displayName));
    return m;
  }, [trackedTickers]);

  // Load all price history in one call, group by ticker
  useEffect(() => {
    if (holdings.length === 0) return;
    const portfolioTickers = new Set(holdings.map(p => p.ticker));
    setLoadingPrices(true);
    setPriceError(null);

    getTickerPriceHistory()
      .then(all => {
        const rawMap: Record<string, { date: string; price: number }[]> = {};
        all
          .filter(d => portfolioTickers.has(d.ticker) && d.price > 0)
          .forEach(d => {
            if (!rawMap[d.ticker]) rawMap[d.ticker] = [];
            rawMap[d.ticker].push({ date: d.date, price: d.price });
          });

        const sorted: Record<string, number[]> = {};
        Object.entries(rawMap).forEach(([ticker, entries]) => {
          const prices = entries
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(e => e.price);
          if (prices.length >= 20) sorted[ticker] = prices;
        });
        setPricesByTicker(sorted);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (Object.keys(pricesByTicker).length >= 2) runSim(); }, [pricesByTicker]);

  // Target risk level chosen by the user via slider
  const [targetVol, setTargetVol] = useState<number | null>(null);

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

      {holdings.length > 0 && (
        <HoldingsTable holdings={holdingStats} nameByTicker={nameByTicker} totalValue={totalValue} />
      )}

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
      ) : (
        holdings.length > 0 && Object.keys(pricesByTicker).length < 2 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Need price history for at least 2 holdings to run the optimizer.
            Open each ticker in Tracked Tickers and fetch its historical data first.
          </Alert>
        )
      )}

      <ProjectionSection sim={sim} targetPortfolio={targetPortfolio} portfolioValue={totalValue} />
    </Box>
  );
};

export default PortfolioPlanner;
