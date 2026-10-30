import { useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';
import type { Allowance } from '../../types';

export interface AllowanceBarProps {
  allowance: Allowance;
  /** Sets a lower cap of one's own, as a share of the allowance; null clears it. */
  onCap: (capPercent: number | null) => Promise<void>;
}

/** The caps on offer. A cap already set to something else is added to the list rather than lost. */
const CAPS = [75, 50, 25];

const day = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * What is left of this month's assistant allowance, as a share, never as money
 * or tokens: people think in "most of it" and "nearly out", not in cents.
 * Their own lower cap sits beside it, for anyone who wants to stop earlier.
 */
export function AllowanceBar({ allowance, onCap }: AllowanceBarProps) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (allowance.limit === null) {
    return (
      <Typography variant="body2" sx={{ color: ink.muted }}>
        Your plan has no limit on assistants.
      </Typography>
    );
  }

  const percent = allowance.percent ?? 0;
  const options = allowance.capPercent && !CAPS.includes(allowance.capPercent) ? [allowance.capPercent, ...CAPS] : CAPS;

  const choose = async (value: string) => {
    setSaving(true);
    setFailed(false);
    try {
      await onCap(value === '' ? null : Number(value));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(percent, 100)}
        color={allowance.exhausted ? 'error' : 'primary'}
        aria-label="Assistant allowance used"
        sx={{ height: 8, borderRadius: 4, mb: 1 }}
      />
      <Typography variant="body2">
        {allowance.exhausted
          ? `You've used this month's assistant allowance. It starts again on ${day(allowance.resetsOn)}.`
          : `You've used ${percent}% of this month's assistant allowance. It starts again on ${day(allowance.resetsOn)}.`}
      </Typography>
      {allowance.exhausted && (
        <Typography variant="body2" sx={{ color: ink.muted, mt: 0.5 }}>
          Need more? Upgrade your plan, or ask whoever runs Tumbaland.
        </Typography>
      )}
      <TextField
        select
        size="small"
        label="Stop at"
        value={allowance.capPercent === null ? '' : String(allowance.capPercent)}
        onChange={(event) => void choose(event.target.value)}
        disabled={saving}
        error={failed}
        helperText={failed ? 'Could not save that. Try again.' : 'Assistants stop for you once you have used this much.'}
        sx={{ mt: 2, minWidth: 220 }}
      >
        <MenuItem value="">All of it</MenuItem>
        {options.map((cap) => (
          <MenuItem key={cap} value={String(cap)}>
            {cap}% of it
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
