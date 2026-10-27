import { Box, Typography } from '@mui/material';
import { ink, surface } from '@tumbaland/frontend-core';
import { formatAmount, formatLimit } from '../format';
import { vizVars } from './charts/colors';

interface UsageBarProps {
  label: string;
  used: number;
  /** `-1` is no ceiling. */
  limit: number;
  unit: 'bytes' | 'count';
  /** False when nothing counts this meter, so a bar of zero would claim something nobody knows. */
  metered?: boolean;
}

/**
 * How much of a plan's allowance has been used.
 *
 * Says it in words as well as in the bar, and goes over the end of the bar in a
 * different colour only when the allowance really is exceeded.
 */
export function UsageBar({ label, used, limit, unit, metered = true }: UsageBarProps) {
  const unlimited = limit < 0;
  const fraction = unlimited || limit === 0 ? 0 : used / limit;
  const over = !unlimited && used > limit;

  return (
    <Box sx={{ ...vizVars }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: ink.strong }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, color: ink.body, textAlign: 'right' }}>
          {metered
            ? `${formatAmount(used, unit)} of ${formatLimit(limit, unit)}`
            : `Not counted yet (limit ${formatLimit(limit, unit)})`}
        </Typography>
      </Box>
      {metered && !unlimited && (
        <Box
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          sx={{ mt: 0.75, height: 8, borderRadius: '4px', bgcolor: surface.sunken, overflow: 'hidden' }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${Math.min(fraction, 1) * 100}%`,
              bgcolor: over ? 'error.main' : 'var(--viz)',
              borderRadius: '4px'
            }}
          />
        </Box>
      )}
      {over && (
        <Typography sx={{ fontSize: 12, color: 'error.main', mt: 0.5 }}>Over the allowance</Typography>
      )}
    </Box>
  );
}
