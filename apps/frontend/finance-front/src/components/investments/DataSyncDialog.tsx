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

/**
 * Freshness in the terms a market actually has them: a close from Friday read
 * on Sunday is current, not two days stale, so the wording stays vague enough
 * to be true over a weekend.
 */
export function freshnessLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const days = daysSince(iso, now);
  if (days === null) return 'never';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 6) return `${days} days ago`;
  if (days <= 13) return 'last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * Daily closes stop on weekends and holidays, so "stale" has to allow for a
 * long weekend before it means anything. Weekly closes arrive once a week, and
 * are given a fortnight before they count as stale.
 */
export function isStale(last: string | null | undefined, interval: 'daily' | 'weekly', now = new Date()): boolean {
  const days = daysSince(last, now);
  if (days === null) return false; // "never" is a separate state, not staleness
  return interval === 'daily' ? days > 4 : days > 14;
}

const shortDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

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
              label={`updated ${freshnessLabel(data?.last)}`}
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
