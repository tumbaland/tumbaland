import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ink, surface } from '@tumbaland/frontend-core';

/** "Today", "Yesterday", or the date, for the divider between days. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  // `<= 0` rather than `=== 0`: an optimistic message is stamped with the
  // sending device's clock, so one running a little fast produces a timestamp
  // in the future. That must read as Today, not as a weekday name.
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  // Inside a week the weekday is more use than the date; beyond it, the date.
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function DaySeparator({ iso }: { iso: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
      <Typography
        variant="caption"
        sx={{
          px: 1.5,
          py: 0.4,
          borderRadius: 999,
          bgcolor: surface.sunken,
          color: ink.muted,
          fontWeight: 500
        }}
      >
        {dayLabel(iso)}
      </Typography>
    </Box>
  );
}
