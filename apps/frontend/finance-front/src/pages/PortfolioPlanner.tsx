import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, AlertTitle, Button, Tabs, Tab } from '@mui/material';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { usePersistedState } from '../hooks/usePersistedState';
import { useQuery } from '@tanstack/react-query';
import { getTickerPriceHistory } from '../services/tickerPriceHistoryService';
import { getMyEntitlements } from '../services/entitlementsService';
import { getGlobalConfig } from '../config/ConfigProvider';
import {
  AlignedSeries,
  FrontierSim,
  MAX_GAP_DAYS,
  PricePoint,
  ReturnBasis,
  WEEKLY_REACH_ADVANTAGE,
  alignSeries,
  coverageDays,
  findLimitingHolding,
  returnIndices,
  runFrontierSimulation
} from '../utils/frontierSim';
import { DEFAULT_ANCHOR_PCT, ReturnMode, frontierPointAtVol } from '../utils/optimizer';
import FrontierSection from '../components/planner/FrontierSection';
import PlanSection from '../components/planner/PlanSection';

/** How far back to pull daily closes for the covariance estimate. */
const HISTORY_YEARS = 2;
/**
 * Below this much history the frontier is not worth computing.
 *
 * Both numbers are measured on the *aligned* series — the days on which every
 * holding traded — because that overlap, not the longest single series, is what
 * the covariance is estimated from. A holding added last month caps the whole
 * estimate, however deep the others reach.
 *
 * The span was 365 and is 120 because 365 was unreachable *on daily closes*:
 * the provider's free tier serves only the compact ~100 trading days and
 * refuses `outputsize=full` as a premium feature, so a freshly tracked
 * instrument cannot exceed a year of daily history until a year of daily
 * updates has accrued — the gate blocked every account, paying or not, rather
 * than only clipped ones. (Its weekly endpoint does return a decade for free,
 * which is why weekly closes are now stored; this page does not read them yet.)
 * The per-asset rule is the part that actually protects the estimate: a
 * covariance matrix over k assets fitted on fewer than ~10k observations is
 * noise dressed as a recommendation.
 */
const MIN_ALIGNED_DAYS = 120;
const MIN_OBSERVATIONS_PER_ASSET = 10;

// Merged replacement for the old Portfolio Optimizer + Stock Growth Calculator
// pages: the frontier simulation's return/volatility estimates feed the
// long-horizon growth projection instead of asking the user to guess them.
const PortfolioPlanner: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const { data: holdings = [], isLoading: holdingsLoading, refetch: refetchHoldings } = useHoldings(tenantGroupId);
  const { data: trackedTickers = [] } = useTrackedTickers(tenantGroupId);

  /** Both series, kept side by side so the basis can be chosen from the data. */
  const [seriesByBasis, setSeriesByBasis] = useState<Record<ReturnBasis, Record<string, PricePoint[]>>>({
    daily: {},
    weekly: {}
  });
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  /** False until the first load resolves, so "no data yet" cannot read as "too little". */
  const [pricesLoaded, setPricesLoaded] = useState(false);
  /** Bumped by the refresh button, which reloads the prices and solves the frontier again. */
  const [refreshCount, setRefreshCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // The caller's own retention window, which decides whether a short history is
  // something they can buy their way out of. `retry: false` and no error
  // branch: an unreachable payment-service must not cost anyone the planner.
  const { data: entitlements } = useQuery({
    queryKey: ['myEntitlements'],
    queryFn: () => getMyEntitlements(),
    staleTime: 60 * 1000,
    retry: false
  });
  const [riskFreeRate, setRiskFreeRate] = usePersistedState('finance-planner-risk-free-rate', '3'); // % per year
  // What the frontier assumes. Returns are blended toward a long-run figure by
  // default, because history alone rewards whatever did best recently.
  const [returnMode, setReturnMode] = usePersistedState<ReturnMode>('finance-planner-return-mode', 'shrunk');
  const [anchorPct, setAnchorPct] = usePersistedState('finance-planner-anchor', String(DEFAULT_ANCHOR_PCT)); // % per year
  // Capped by default: with no limit the minimum-risk answer is usually the two
  // least correlated holdings and nothing else.
  const [maxWeight, setMaxWeight] = usePersistedState('finance-planner-max-weight', '40'); // % of the portfolio
  /** Holdings left out of the frontier, because a young one would cap the history of the rest. */
  const [excluded, setExcluded] = usePersistedState<string[]>('finance-planner-excluded', []);
  const [tab, setTab] = useState(0);

  const nameByTicker = useMemo(() => {
    const m: Record<string, string> = {};
    trackedTickers.forEach((t) => (m[t.ticker] = t.displayName));
    return m;
  }, [trackedTickers]);

  // Load price history for the held tickers only, grouped by ticker. The
  // simulation needs roughly the last two years of daily closes, so the range
  // is bounded too — the full collection is unbounded and mostly irrelevant here.
  useEffect(() => {
    if (holdings.length === 0) return;
    const portfolioTickers = [...new Set(holdings.map((p) => p.ticker))];
    setLoadingPrices(true);
    setPriceError(null);

    const from = new Date();
    from.setFullYear(from.getFullYear() - HISTORY_YEARS);
    const fromDate = from.toISOString().slice(0, 10);

    /**
     * Both series are loaded, because which one gives the better estimate is a
     * property of the data rather than a setting. Weekly closes reach back a
     * decade where the provider's free tier caps daily history at ~100 trading
     * days; daily wins once enough of it has accrued. See `chosen` below.
     */
    const load = (basis: ReturnBasis) =>
      Promise.all(
        portfolioTickers.map((ticker) =>
          getTickerPriceHistory({
            ticker,
            // Weekly is only worth loading for its depth, so it is not clipped
            // to the daily window.
            ...(basis === 'daily' ? { from: fromDate } : {}),
            interval: basis
          })
        )
      ).then((perTicker) => {
        const rawMap: Record<string, PricePoint[]> = {};
        perTicker
          .flat()
          .filter((d) => d.price > 0)
          .forEach((d) => {
            if (!rawMap[d.ticker]) rawMap[d.ticker] = [];
            rawMap[d.ticker].push({ date: d.date, price: d.price });
          });

        // Dates are carried through rather than discarded here: the sim aligns
        // the series on the days they share, which a bare price array cannot
        // express. The 20-point floor is per ticker; the real sufficiency test
        // runs on the overlap below.
        const sorted: Record<string, PricePoint[]> = {};
        Object.entries(rawMap).forEach(([ticker, entries]) => {
          const chronological = entries.sort((a, b) => a.date.localeCompare(b.date));
          if (chronological.length >= 20) sorted[ticker] = chronological;
        });
        return sorted;
      });

    Promise.all([load('daily'), load('weekly')])
      .then(([daily, weekly]) => {
        setSeriesByBasis({ daily, weekly });
        setPricesLoaded(true);
        setUpdatedAt(new Date());
      })
      .catch(() => setPriceError('Failed to load price history'))
      .finally(() => setLoadingPrices(false));
  }, [holdings, refreshCount]);

  /**
   * Which series to estimate from, and the overlap it yields.
   *
   * **The basis that covers more market wins**, with daily kept unless weekly
   * reaches clearly further. Counting observations picked five months of daily
   * closes over two and a half years of weekly ones, because 165 beats 125, and
   * the free data tier will never serve daily history past ~100 days. Over the
   * same stretch daily has five times the observations, so it stays when the
   * two are close, and it takes over again on its own once enough has accrued.
   * No setting, and nothing to keep in sync.
   *
   * Holdings in `excluded` are left out first, so the overlap is measured on
   * the ones that are actually being optimized.
   */
  const { basis, aligned, pricesByTicker, limiting } = useMemo(() => {
    const usable = (candidate: ReturnBasis) => {
      const series = Object.fromEntries(Object.entries(seriesByBasis[candidate]).filter(([t]) => !excluded.includes(t)));
      const alignment = alignSeries(series);
      // Gap-spanning steps are dropped by the sim, so they are not counted here.
      const observations = returnIndices(alignment.dates, MAX_GAP_DAYS[candidate]).length;
      return {
        basis: candidate,
        aligned: alignment,
        pricesByTicker: series,
        coverage: coverageDays(observations, candidate)
      };
    };

    const daily = usable('daily');
    const weekly = usable('weekly');
    const chosen = weekly.coverage > daily.coverage * WEEKLY_REACH_ADVANTAGE ? weekly : daily;
    return { ...chosen, limiting: findLimitingHolding(chosen.pricesByTicker) };
  }, [seriesByBasis, excluded]);

  const alignedSeries: AlignedSeries = aligned;

  /**
   * Whether the overlap is long enough to estimate a covariance from. Before
   * the first load resolves this must read as "yes": an empty page is not a
   * page with too little history.
   */
  const hasEnoughHistory =
    !pricesLoaded ||
    (alignedSeries.spanDays >= MIN_ALIGNED_DAYS &&
      alignedSeries.dates.length >= MIN_OBSERVATIONS_PER_ASSET * alignedSeries.tickers.length);

  /**
   * Whether the plan is what is holding the history back.
   *
   * Retention clips reads to a window ending today, so a clipped series spans
   * almost exactly `retentionDays`. An account with unlimited retention (or one
   * whose data simply starts later than its window allows) is not looking at a
   * paywall, and telling them to upgrade would be selling something they
   * already have.
   */
  const retentionDays = entitlements?.limits?.retentionDays;
  const clippedByPlan =
    typeof retentionDays === 'number' && retentionDays > 0 && alignedSeries.spanDays >= retentionDays - 7;

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

  // The frontier follows its assumptions: change one and it is solved again.
  // Solved rather than sampled, so there is nothing to re-run by hand.
  const sim: FrontierSim | null = useMemo(() => {
    if (Object.keys(pricesByTicker).length < 2 || !hasEnoughHistory) return null;
    const quantityByTicker: Record<string, number> = {};
    holdings.forEach((h) => (quantityByTicker[h.ticker] = h.quantity));
    return runFrontierSimulation({
      pricesByTicker,
      quantityByTicker,
      riskFreeRatePct: parseFloat(riskFreeRate) || 0,
      basis,
      returnMode,
      anchorPct: parseFloat(anchorPct) || 0,
      maxWeightPct: Math.min(100, Math.max(1, parseFloat(maxWeight) || 100))
    });
  }, [pricesByTicker, hasEnoughHistory, holdings, riskFreeRate, basis, returnMode, anchorPct, maxWeight]);

  // The risk level the user chose with the slider, and only that: until they
  // move it, the target follows the best Sharpe ratio. The default is not
  // saved, because a saved default goes stale the moment an assumption changes
  // the frontier, and the slider then sits stuck at the minimum.
  const [targetVol, setTargetVol] = usePersistedState<number | null>('finance-planner-target-vol', null);

  // The level in use: the chosen one unless it is below the least risk the
  // frontier now allows, in which case it is stale and the best Sharpe takes over.
  const activeTargetVol = useMemo(() => {
    if (!sim) return null;
    return targetVol !== null && targetVol >= sim.minVol.vol - 0.05 ? targetVol : sim.maxSharpe.vol;
  }, [sim, targetVol]);

  // The efficient portfolio at that risk: the most the frontier earns at or below it.
  const targetPortfolio = useMemo(() => {
    if (!sim || activeTargetVol === null) return null;
    return frontierPointAtVol(sim.frontier, activeTargetVol) ?? sim.minVol;
  }, [sim, activeTargetVol]);

  // What the holdings in the frontier are worth, for turning the target weights
  // into euros. Each at its own newest close: unlike the frontier, a holding's
  // value has no reason to wait for the other tickers. Holdings left out are not
  // counted, because the weights do not cover them.
  const totalValue = useMemo(
    () =>
      holdings.reduce((sum, h) => {
        const prices = pricesByTicker[h.ticker];
        return prices?.length ? sum + prices[prices.length - 1].price * h.quantity : sum;
      }, 0),
    [holdings, pricesByTicker]
  );

  // Only the first load replaces the page. A refresh keeps what is on screen, so
  // the amount typed into the buy plan and the switches are still there when the
  // new numbers arrive.
  const isLoading = holdingsLoading || (loadingPrices && !pricesLoaded);

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const tickersWithoutData = holdings.map((p) => p.ticker).filter((t) => !pricesByTicker[t] && !excluded.includes(t));

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Portfolio Planner
      </Typography>
      {priceError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {priceError}
        </Alert>
      )}
      {holdings.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add holdings in the Investments page to see how they could be allocated. The Plan tab works without them.
        </Alert>
      )}
      {tickersWithoutData.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No price history for: {tickersWithoutData.join(', ')}. Fetch data in Tracked Tickers first.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label="Plan" />
        <Tab label="Frontier" />
      </Tabs>

      {/* Panels stay mounted (just hidden) so switching tabs never re-fetches or
          resets in-progress input — only one is visible at a time. */}
      <Box role="tabpanel" hidden={tab !== 0}>
        <PlanSection />
      </Box>

      <Box role="tabpanel" hidden={tab !== 1}>
        {sim ? (
          <FrontierSection
            sim={sim}
            targetPortfolio={targetPortfolio}
            targetVol={activeTargetVol}
            onTargetVolChange={setTargetVol}
            riskFreeRate={riskFreeRate}
            onRiskFreeRateChange={setRiskFreeRate}
            returnMode={returnMode}
            onReturnModeChange={setReturnMode}
            anchorPct={anchorPct}
            onAnchorPctChange={setAnchorPct}
            maxWeight={maxWeight}
            onMaxWeightChange={setMaxWeight}
            onRefresh={() => {
              // Quantities as well as prices: a trade made since the page opened
              // changes the weights the plan starts from.
              void refetchHoldings?.();
              setRefreshCount((count) => count + 1);
            }}
            refreshing={loadingPrices}
            updatedAt={updatedAt}
            limiting={limiting}
            excluded={excluded}
            onExclude={(ticker) => setExcluded((current) => [...new Set([...current, ticker])])}
            onInclude={(ticker) => setExcluded((current) => current.filter((t) => t !== ticker))}
            totalValue={totalValue}
            nameByTicker={nameByTicker}
          />
        ) : holdings.length > 0 && !hasEnoughHistory ? (
          /*
            Deliberately not a frontier computed from what little came back — a
            covariance estimated off a few dozen overlapping closes produces a
            confident, wrong answer.

            Two different things produce that state and they must not be told
            the same way. A free account's reads are clipped to its retention
            window, and *that* is a paywall. An account whose instruments were
            simply tracked recently — or re-keyed, which resets a series — is
            waiting for data, and showing it an upgrade button would be selling
            it something it already has. Only `clippedByPlan` gets the CTA.
          */
          <Alert
            severity="info"
            action={
              clippedByPlan ? (
                <Button color="inherit" size="small" onClick={goToPlans}>
                  See plans
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>Not enough overlapping price history to plan with</AlertTitle>
            The efficient frontier is estimated from the days on which <em>all</em> your holdings traded. Those overlap
            for {alignedSeries.spanDays} days ({alignedSeries.dates.length} {basis} closes across{' '}
            {alignedSeries.tickers.length} holdings), which is too little to tell how they move together — so the
            frontier is not shown rather than shown wrong.
            <br />
            <br />
            {clippedByPlan ? (
              <>
                Your plan keeps {retentionDays} days of price history, which is what the range above is bounded by.
                Plans with full history keep every close ever fetched.
              </>
            ) : (
              <>
                Your plan is not what limits this — that much history simply has not been collected yet. The newest
                holding sets the overlap for all of them. Fetching the full weekly history for each instrument, from the
                sync button on the Tracked tickers tab, is usually the fastest way to widen it.
              </>
            )}
          </Alert>
        ) : (
          holdings.length > 0 &&
          Object.keys(pricesByTicker).length < 2 && (
            <Alert severity="info">
              Need price history for at least 2 holdings to run the optimizer. Open each ticker in Tracked Tickers and
              fetch its historical data first.
            </Alert>
          )
        )}
      </Box>
    </Box>
  );
};

export default PortfolioPlanner;
