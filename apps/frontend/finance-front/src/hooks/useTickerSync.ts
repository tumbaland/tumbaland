import { useEffect, useState } from 'react';
import {
  fetchAllTickerPriceHistory,
  fetchTickerPriceHistory,
  fetchWeeklyTickerPriceHistory,
  getQuota,
  getTickerCoverage,
  QuotaStatus,
  TickerCoverage
} from '../services/tickerPriceHistoryService';
import { SyncAction, closeDate, fetchedAtLabel, isStale } from '../components/investments/DataSyncDialog';

/**
 * Keeping tracked tickers' prices up to date by hand: the provider's quota, how
 * much history each ticker has, and the three ways of fetching more.
 */
export const useTickerSync = (notify: (message: string, severity: 'success' | 'error') => void) => {
  const [syncTicker, setSyncTicker] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<SyncAction | null>(null);

  // The provider's daily quota is shared by everyone on this deployment, so
  // showing what is left turns "it failed, try again" into "there are no calls
  // left today".
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [coverage, setCoverage] = useState<Record<string, TickerCoverage>>({});

  const refreshQuota = () => { getQuota().then(setQuota).catch(() => setQuota(null)); };
  const refreshCoverage = () => {
    getTickerCoverage()
      .then(rows => setCoverage(Object.fromEntries(rows.map(r => [r.ticker, r]))))
      // Coverage is decoration on a table that works without it; a failed
      // lookup leaves the column blank rather than breaking the page.
      .catch(() => setCoverage({}));
  };

  useEffect(() => {
    refreshQuota();
    refreshCoverage();
  }, []);

  /**
   * One handler for all three, because they differ only in which call they make
   * and what they report — and the surrounding concerns (which action is busy,
   * refreshing quota and coverage afterwards, turning a provider rejection into
   * a sentence) are identical and were previously duplicated per button.
   */
  const handleSync = async (action: SyncAction) => {
    if (!syncTicker) return;
    setBusyAction(action);
    try {
      if (action === 'latest') {
        await fetchTickerPriceHistory(syncTicker);
        notify(`Latest price fetched for ${syncTicker}`, 'success');
      } else if (action === 'daily') {
        await fetchAllTickerPriceHistory(syncTicker);
        notify(`Daily price history fetched for ${syncTicker}`, 'success');
      } else {
        const result = await fetchWeeklyTickerPriceHistory(syncTicker);
        notify(`Fetched ${result.recordsCount} weekly closes for ${syncTicker}`, 'success');
      }
    } catch {
      notify(
        `Failed to sync ${syncTicker} — the shared Alpha Vantage allowance may be exhausted for today`,
        'error'
      );
    } finally {
      setBusyAction(null);
      refreshQuota();
      refreshCoverage();
    }
  };

  /** Freshness of the daily series, as the table's own summary of sync state. */
  const lastUpdated = (ticker: string) => {
    const c = coverage[ticker];
    if (!c) return null;
    return {
      // Two separate facts, because one column pretending to be both is what
      // made a working nightly job read as three days stale: `fetchedAt` is
      // when we last asked the provider, `date` is the newest session it had
      // to give. Over a weekend the first moves and the second does not.
      //
      // Both read the *daily* series alone. Weekly is a one-off backfill for
      // depth — its fetch time dates whenever someone last pressed the button,
      // and its newest bar is a week-ending close, so letting either stand in
      // for the daily series would misreport exactly what these columns exist
      // to report. The nightly job maintains daily, and its compact ~100-day
      // response is what silently refills any gap left by an outage.
      fetchedAt: fetchedAtLabel(c.daily.fetchedAt),
      date: c.daily.count > 0 ? closeDate(c.daily.last) : null,
      stale: c.daily.count > 0 ? isStale(c.daily.last, 'daily') : true,
      weeklyYears:
        c.weekly.first && c.weekly.last
          ? (Date.parse(c.weekly.last) - Date.parse(c.weekly.first)) / (365.25 * 86_400_000)
          : 0
    };
  };

  return { quota, coverage, refreshCoverage, syncTicker, setSyncTicker, busyAction, handleSync, lastUpdated };
};
