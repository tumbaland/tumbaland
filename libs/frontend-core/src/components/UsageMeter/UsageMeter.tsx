import { Box, Button, LinearProgress, Tooltip, Typography } from '@mui/material';
import { isUnlimited, usageRatio } from '../../entitlementsService';

/** Fraction of a meter above which the bar turns amber. */
const WARN_AT = 0.8;

export interface UsageMeterProps {
  /** What is being metered, e.g. "Storage" or "Tracked tickers". */
  label: string;
  used: number;
  /** `-1` (or any negative) means no ceiling. */
  limit: number;
  /** Bytes are humanized; counts are printed as-is. */
  unit?: 'bytes' | 'count';
  /** Shown once the meter is at or past the warning threshold. */
  onUpgrade?: () => void;
  upgradeLabel?: string;
  /** Tighter spacing, for a meter sitting inside a list row rather than a card. */
  dense?: boolean;
}

/**
 * Humanizes to the largest unit that keeps the number readable.
 *
 * Deliberately binary (1 KB = 1024 B) to match the limits, which are set in
 * powers of two — `1 * GB` in `DEFAULT_PLAN_LIMITS` is 1073741824, and
 * rendering that as "1.07 GB" against a "1 GB" plan would look like an error.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  // Two decimals below 10 and one above, then no trailing zeros: "1.07 GB",
  // "1.5 GB" and "1 GB", never "1.50 GB" or "1.00 GB".
  const decimals = exponent === 0 ? 0 : value < 10 ? 2 : 1;
  return `${Number(value.toFixed(decimals))} ${units[exponent]}`;
}

function formatValue(value: number, unit: 'bytes' | 'count'): string {
  return unit === 'bytes' ? formatBytes(value) : value.toLocaleString();
}

/**
 * A labelled usage bar: what you have used, out of what your plan allows.
 *
 * The single highest-leverage piece of the paywall — people upgrade when they
 * can see the ceiling coming, not when they hit it. It is also what keeps
 * enforcement from reading as breakage: a 402 with no meter beside it is
 * indistinguishable from a bug.
 *
 * Purely presentational. It takes numbers, never fetches them, so the same
 * component serves the album dashboard, the ticker list, the group member list
 * and the pricing table without any of them agreeing on a data layer.
 */
export function UsageMeter({
  label,
  used,
  limit,
  unit = 'count',
  onUpgrade,
  upgradeLabel = 'Upgrade',
  dense = false
}: UsageMeterProps) {
  const unlimited = isUnlimited(limit);
  const ratio = usageRatio(used, limit);
  const atLimit = !unlimited && used >= limit;
  const warning = !unlimited && ratio >= WARN_AT;

  const color = atLimit ? 'error' : warning ? 'warning' : 'primary';
  const summary = unlimited
    ? `${formatValue(used, unit)} used`
    : `${formatValue(used, unit)} of ${formatValue(limit, unit)}`;

  return (
    <Box sx={{ width: '100%', mb: dense ? 1 : 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography variant={dense ? 'caption' : 'body2'} sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography
          variant={dense ? 'caption' : 'body2'}
          sx={{ fontWeight: 600, color: atLimit ? 'error.main' : 'text.primary' }}
        >
          {summary}
        </Typography>
      </Box>

      {/*
        An unlimited meter still shows its usage number, but no bar: a full bar
        would read as "you are at your limit" and an empty one implies a ceiling
        that does not exist. Staff and comped accounts live here.
      */}
      {unlimited ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Unlimited on your plan
        </Typography>
      ) : (
        <Tooltip title={`${Math.round(ratio * 100)}% of ${label.toLowerCase()} used`}>
          <LinearProgress
            variant="determinate"
            value={ratio * 100}
            color={color}
            aria-label={label}
            // Read by assistive tech and by the tests: the visual bar saturates
            // at 100% but the underlying numbers are the honest ones.
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
            sx={{ height: dense ? 4 : 8, borderRadius: 4 }}
          />
        </Tooltip>
      )}

      {onUpgrade && warning && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: atLimit ? 'error.main' : 'warning.main' }}>
            {atLimit
              ? `You have reached your ${label.toLowerCase()} limit.`
              : `You are close to your ${label.toLowerCase()} limit.`}
          </Typography>
          <Button size="small" variant="text" onClick={onUpgrade}>
            {upgradeLabel}
          </Button>
        </Box>
      )}
    </Box>
  );
}
