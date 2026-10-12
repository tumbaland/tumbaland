import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, ButtonBase, CircularProgress, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { logger } from '@tumbaland/frontend-core';
import { Day } from '../services/types';
import { getDays } from '../services/days';
import { localDayKey } from '../utils/dates';

/** The first of a month, as the calendar keeps it: { year, month (0-11) }. */
export interface CalendarMonth {
  year: number;
  month: number;
}

interface JournalCalendarProps {
  month: CalendarMonth;
  onMonthChange: (month: CalendarMonth) => void;
  groupId?: string;
  typeId?: string;
  search?: string;
  /** bumped by the page after a save, so the month on screen is fetched again */
  refreshKey: number;
  onDayClick: (date: string) => void;
}

/** How many entries a cell lists by name before it says "+n more". */
const NAMED_ENTRIES = 2;

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

export const currentMonth = (): CalendarMonth => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
};

const shiftMonth = ({ year, month }: CalendarMonth, by: number): CalendarMonth => {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

// 1 January 2024 was a Monday; the week starts on Monday here.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' })
);

/**
 * One month of the journal as a grid. Logged days show a dot per entry in its
 * type's colour (and the type names where there is room); tapping a day opens
 * it in the editor, the same as a card in the list. Days after today are
 * greyed out, since the editor won't log them.
 */
const JournalCalendar: React.FC<JournalCalendarProps> = ({
  month,
  onMonthChange,
  groupId,
  typeId,
  search,
  refreshKey,
  onDayClick
}) => {
  const [days, setDays] = useState<Map<string, Day>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const startDate = dateKey(month.year, month.month, 1);
  const endDate = dateKey(month.year, month.month, daysInMonth);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDays({ page: 1, limit: 31, groupId, typeId, search, startDate, endDate })
      .then((result) => {
        if (!cancelled) setDays(new Map(result.days.map((d) => [d.date, d])));
      })
      .catch((e) => {
        logger.error('Failed to load the calendar month', e);
        if (!cancelled) setError('Failed to load this month');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, typeId, search, startDate, endDate, refreshKey]);

  // Blank cells before the 1st so it lands under its weekday, then the days.
  const cells = useMemo(() => {
    const leading = (new Date(month.year, month.month, 1).getDay() + 6) % 7;
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];
  }, [month.year, month.month, daysInMonth]);

  const now = new Date();
  const today = localDayKey(now);
  const isCurrentMonth = month.year === now.getFullYear() && month.month === now.getMonth();
  const title = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <IconButton size="small" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 600, minWidth: 0, flex: 1, textAlign: 'center' }}>{title}</Typography>
        <IconButton size="small" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 30, mb: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {loading ? '' : `${days.size} day${days.size === 1 ? '' : 's'} logged this month`}
        </Typography>
        {!isCurrentMonth && (
          <Button size="small" onClick={() => onMonthChange(currentMonth())} sx={{ textTransform: 'none' }}>
            This month
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 0.75 } }}>
          {WEEKDAYS.map((name) => (
            <Typography
              key={name}
              variant="caption"
              sx={{ color: 'text.secondary', textAlign: 'center', fontWeight: 600 }}
            >
              {name}
            </Typography>
          ))}

          {cells.map((dayOfMonth, i) => {
            if (dayOfMonth === null) return <Box key={`blank-${i}`} />;
            const date = dateKey(month.year, month.month, dayOfMonth);
            const day = days.get(date);
            const entries = day?.entries ?? [];
            const future = date > today;
            const label = new Date(month.year, month.month, dayOfMonth).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            });
            return (
              <ButtonBase
                key={date}
                disabled={future}
                onClick={() => onDayClick(date)}
                aria-label={entries.length ? `${label}, ${entries.length} logged` : label}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  minWidth: 0,
                  minHeight: { xs: 52, sm: 88 },
                  p: { xs: 0.5, sm: 0.75 },
                  borderRadius: 1.5,
                  border: 1,
                  borderColor: date === today ? 'primary.main' : 'divider',
                  bgcolor: entries.length ? 'action.hover' : 'transparent',
                  opacity: future ? 0.4 : 1,
                  textAlign: 'left',
                  '&:hover': { borderColor: 'primary.main' }
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: date === today ? 700 : 500, color: date === today ? 'primary.main' : 'text.primary' }}
                >
                  {dayOfMonth}
                </Typography>

                {entries.length > 0 && (
                  <>
                    {/* phones: one dot per entry */}
                    <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexWrap: 'wrap', gap: '3px', mt: 0.5 }}>
                      {entries.map((entry) => (
                        <Box
                          key={entry._id}
                          sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: entry.type?.color || '#9e9e9e' }}
                        />
                      ))}
                    </Box>
                    {/* wider screens: the first few by name */}
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                      {entries.slice(0, NAMED_ENTRIES).map((entry) => (
                        <Box key={entry._id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 7,
                              height: 7,
                              flexShrink: 0,
                              borderRadius: '50%',
                              bgcolor: entry.type?.color || '#9e9e9e'
                            }}
                          />
                          <Typography variant="caption" noWrap sx={{ lineHeight: 1.3 }}>
                            {entry.type?.name || 'Unknown'}
                          </Typography>
                        </Box>
                      ))}
                      {entries.length > NAMED_ENTRIES && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
                          +{entries.length - NAMED_ENTRIES} more
                        </Typography>
                      )}
                    </Box>
                  </>
                )}
              </ButtonBase>
            );
          })}
        </Box>

        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default JournalCalendar;
