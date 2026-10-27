import { Box, Tooltip, Typography } from '@mui/material';
import { ink, surface } from '@tumbaland/frontend-core';
import { formatCount, formatDay } from '../../format';
import { vizVars } from './colors';

export interface CalendarDay {
  day: string;
  visits: number;
  backfilled: boolean;
}

interface CalendarStripProps {
  from: string;
  to: string;
  /** Only the days that had any activity. */
  days: CalendarDay[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const parse = (day: string): number => Date.parse(`${day}T00:00:00Z`);

/** Every day from `from` to `to`, as `YYYY-MM-DD`. */
const range = (from: string, to: string): string[] => {
  const days: string[] = [];
  for (let at = parse(from); at <= parse(to); at += DAY_MS) days.push(new Date(at).toISOString().slice(0, 10));
  return days;
};

/** How strong a day is drawn: one visit is a light tint, three or more is full. Never fully transparent, so it reads as a day that happened. */
const strength = (visits: number): number => (visits >= 3 ? 100 : visits === 2 ? 70 : 45);

/**
 * Which days a person was here, as a calendar of small squares, a column a week
 * and a row a weekday (Monday on top).
 *
 * A day is darker the more times they came. Days that were filled in from the
 * audit trail rather than counted (see `UserDay.backfilled`) are striped, since
 * they only know the person wrote something and so undercount.
 */
export function CalendarStrip({ from, to, days }: CalendarStripProps) {
  const byDay = new Map(days.map((day) => [day.day, day]));
  // Monday is the first row: shift so the first week starts on the right row.
  const leading = (new Date(parse(from)).getUTCDay() + 6) % 7;
  const cells = range(from, to);

  return (
    <Box sx={{ ...vizVars }}>
      <Box
        role="group"
        aria-label={`Days active, ${formatDay(from)} to ${formatDay(to)}`}
        sx={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridTemplateRows: 'repeat(7, 14px)',
          gridAutoColumns: '14px',
          gap: '2px',
          overflowX: 'auto',
          pb: 0.5
        }}
      >
        {Array.from({ length: leading }, (_, index) => (
          <Box key={`blank-${index}`} aria-hidden />
        ))}
        {cells.map((day) => {
          const seen = byDay.get(day);
          const visits = seen?.visits ?? 0;
          const label = seen
            ? `${formatDay(day)}: ${formatCount(visits)} ${visits === 1 ? 'visit' : 'visits'}${seen.backfilled ? ' (counted from what they wrote)' : ''}`
            : `${formatDay(day)}: not here`;
          return (
            <Tooltip key={day} title={label} arrow disableInteractive enterTouchDelay={0}>
              <Box
                tabIndex={0}
                role="img"
                aria-label={label}
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '3px',
                  bgcolor: seen ? `color-mix(in srgb, var(--viz) ${strength(visits)}%, transparent)` : surface.sunken,
                  ...(seen?.backfilled
                    ? {
                        backgroundImage:
                          'repeating-linear-gradient(135deg, transparent 0 2px, rgba(255,255,255,0.55) 2px 3px)'
                      }
                    : null),
                  '&:focus-visible': { outline: `2px solid ${ink.strong}`, outlineOffset: 1 }
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: 12, color: ink.muted, mt: 0.5 }}>
        Each square is a day, darker the more times they came. Striped days were filled in from what they wrote, so
        they undercount.
      </Typography>
    </Box>
  );
}
