import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import HistoryIcon from '@mui/icons-material/History';
import UpdateIcon from '@mui/icons-material/Update';
import { IntervalCoverage, QuotaStatus, TickerCoverage } from '../../services/tickerPriceHistoryService';

/**
 * What history an instrument has, how stale it is, and what each way of
 * extending it costs.
 *
 * Replaces three unlabelled icon buttons. The actions were always the easy
 * part; what was missing is the state they act on — a user seeing a short chart
 * cannot distinguish "listed recently", "the daily job stopped" and "nobody
 * ever fetched history", and those want different buttons. Each option is shown
 * with what it will actually add and what it spends from a provider budget the
 * whole deployment shares.
 */

export type SyncAction = 'latest' | 'daily' | 'weekly';

interface DataSyncDialogProps {
  open: boolean;
  ticker: string | null;
  displayName?: string;
  /** When the instrument started being tracked — often the reason a series is short. */
  dateAdded?: string;
  coverage?: TickerCoverage;
  quota: QuotaStatus | null;
  /** The action currently running, so the dialog can show which one is busy. */
  busy: SyncAction | null;
  onSync: (action: SyncAction) => void;
  onClose: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between a close and now, or null when there is no close. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/** UTC day index for a timestamp. Day 0 is 1970-01-01, a Thursday. */
const utcDay = (ms: number) => Math.floor(ms / DAY_MS);

/** Weekdays (Mon–Fri) in the half-open range of UTC day indices [from, to). */
function weekdaysBetween(from: number, to: number): number {
  if (to <= from) return 0;
  const fullWeeks = Math.floor((to - from) / 7);
  let count = fullWeeks * 5;
  // At most six days remain after the whole weeks, so this stays cheap even for
  // a series that stopped updating years ago.
  for (let d = from + fullWeeks * 7; d < to; d++) {
    const weekday = (d + 4) % 7; // 0 = Sunday
    if (weekday >= 1 && weekday <= 5) count++;
  }
  return count;
}

/**
 * Trading sessions that have closed and been missed since a bar — today's is
 * excluded, because until the evening job runs there is no bar for it to be
 * behind on.
 */
export function sessionsSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return weekdaysBetween(utcDay(then) + 1, utcDay(now.getTime()));
}

/**
 * A session date, in the viewer's locale format.
 *
 * Held in UTC on purpose: a bar's date is a calendar date, not an instant, and
 * converting it to local time would show the 6th to a viewer west of Greenwich
 * for a session the chart plots on the 7th. Only the *format* is localized.
 */
export function closeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  });
}

/**
 * When a fetch last ran, to the second, in the viewer's own locale and zone.
 *
 * This one *is* an instant, so unlike {@link closeDate} it is shown in local
 * time — the question it answers is "when did my machine last get data", and
 * seconds are what distinguish a run that just happened from one that did not.
 */
export function fetchedAtLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Daily closes stop on weekends and holidays, so "stale" has to allow for a
 * long weekend before it means anything — counting sessions rather than days
 * gets that for free, and gets exchange holidays right too, which a fixed
 * calendar tolerance never could. Weekly closes arrive once a week, and are
 * given a fortnight before they count as stale.
 */
export function isStale(last: string | null | undefined, interval: 'daily' | 'weekly', now = new Date()): boolean {
  const days = daysSince(last, now);
  if (days === null) return false; // "never" is a separate state, not staleness
  return interval === 'daily' ? (sessionsSince(last, now) ?? 0) > 1 : days > 14;
}

const shortDate = (iso: string | null) => closeDate(iso) ?? '—';

function yearsBetween(first: string | null, last: string | null): number | null {
  if (!first || !last) return null;
  return (Date.parse(last) - Date.parse(first)) / (365.25 * DAY_MS);
}

const CoverageRow: React.FC<{
  label: string;
  interval: 'daily' | 'weekly';
  data: IntervalCoverage | undefined;
  note: string;
}> = ({ label, interval, data, note }) => {
  const count = data?.count ?? 0;
  const years = yearsBetween(data?.first ?? null, data?.last ?? null);
  const stale = isStale(data?.last, interval);

  return (
    <Box sx={{ py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label}</Typography>
        {count === 0 ? (
          <Chip size="small" label="none stored" />
        ) : (
          <>
            <Chip size="small" label={`${count.toLocaleString()} closes`} />
            {years !== null && years >= 0.1 && (
              <Chip size="small" label={years >= 1 ? `${years.toFixed(1)} years` : `${Math.round(years * 12)} months`} />
            )}
            <Chip
              size="small"
              color={stale ? 'warning' : 'success'}
              variant={stale ? 'filled' : 'outlined'}
              label={`updated ${closeDate(data?.last) ?? 'never'}`}
            />
          </>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {count > 0 && `${shortDate(data?.first ?? null)} → ${shortDate(data?.last ?? null)} · `}
        {note}
      </Typography>
    </Box>
  );
};

const DataSyncDialog: React.FC<DataSyncDialogProps> = ({
  open,
  ticker,
  displayName,
  dateAdded,
  coverage,
  quota,
  busy,
  onSync,
  onClose
}) => {
  const noQuota = quota?.remaining === 0;
  const weeklyCount = coverage?.weekly.count ?? 0;

  const action = (key: SyncAction, label: string, icon: React.ReactNode, help: string) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1 }}>
      <Button
        variant={key === 'weekly' && weeklyCount === 0 ? 'contained' : 'outlined'}
        size="small"
        startIcon={busy === key ? <CircularProgress size={16} color="inherit" /> : icon}
        disabled={busy !== null || noQuota}
        onClick={() => onSync(key)}
        sx={{ minWidth: 160, flexShrink: 0 }}
      >
        {label}
      </Button>
      <Typography variant="caption" sx={{ color: 'text.secondary', pt: 0.5 }}>
        {help}
      </Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        Price data for {ticker}
        {(displayName || dateAdded) && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {displayName}
            {displayName && dateAdded && ' · '}
            {dateAdded && `tracked since ${dateAdded.slice(0, 10)}`}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        <CoverageRow
          label="Daily closes"
          interval="daily"
          data={coverage?.daily}
          note="Updated automatically every evening. Used for charts and recent performance."
        />
        <Divider />
        <CoverageRow
          label="Weekly closes"
          interval="weekly"
          data={coverage?.weekly}
          note="The long history behind the portfolio planner's risk estimates."
        />

        {weeklyCount === 0 && (
          /*
            The one recommendation worth making unprompted: on the free provider
            tier the daily endpoint returns about 100 trading days and nothing
            can widen it, while the weekly endpoint returns the entire series for
            the same single call. An instrument with no weekly history has a
            planner estimate built on a few months of data, and one click fixes
            it permanently.
          */
          <Alert severity="info" sx={{ mt: 2 }}>
            No long history stored for this instrument. <b>Fetch full weekly history</b> pulls its
            whole series — usually 10 to 20 years — for one API call, the same cost as fetching a
            hundred days of daily prices.
          </Alert>
        )}

        <Divider sx={{ mt: 2 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>
          Sync now
        </Typography>

        {action('latest', 'Latest price', <UpdateIcon fontSize="small" />, "Today's close only. 1 API call.")}
        {action(
          'daily',
          'Last ~100 days',
          <CloudDownloadIcon fontSize="small" />,
          'Fills gaps in the recent daily series. 1 API call — the provider caps this at about 100 trading days.'
        )}
        {action(
          'weekly',
          'Full weekly history',
          <HistoryIcon fontSize="small" />,
          'The instrument\'s entire weekly series, 10+ years. 1 API call. Needed once per instrument.'
        )}

        {quota && (
          <Alert severity={noQuota ? 'error' : quota.remaining <= 5 ? 'warning' : 'info'} sx={{ mt: 2 }}>
            {noQuota ? (
              <>No API calls left today. The allowance is shared by everyone on this deployment and resets at 00:00 UTC.</>
            ) : (
              <>
                {quota.remaining} of {quota.limit} API calls left today, shared across the whole
                deployment.
              </>
            )}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={busy !== null}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DataSyncDialog;
