import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, ButtonBase, CircularProgress, IconButton, Typography } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { logger } from '@tumbaland/frontend-core';
import { Day, Plan } from '../services/types';
import { getDays } from '../services/days';
import { getPlans } from '../services/plans';
import { localDayKey } from '../utils/dates';
import PlanRow from './PlanRow';

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
  /** a day up to today: open it in the day editor */
  onDayClick: (date: string) => void;
  /** a plan, from its day or the list under the month */
  onPlanClick: (plan: Plan) => void;
  /** a day after today with no plan to open: make one on it */
  onNewPlan: (date: string) => void;
}

/** How many entries and plans a cell lists by name before it says "+n more". */
const NAMED_ENTRIES = 2;

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** The day after a YYYY-MM-DD day. */
const nextDay = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  return localDayKey(new Date(year!, month! - 1, date! + 1));
};

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
 * type's colour (and the type names where there is room), and plans show as a
 * ring with their time. Tapping a day up to today opens it in the editor, the
 * same as a card in the list; tapping a later day opens its plan, or starts
 * one on it. The month's plans are also listed under the grid, since a phone's
 * cells are too small to tap one plan among several.
 */
const JournalCalendar: React.FC<JournalCalendarProps> = ({
  month,
  onMonthChange,
  groupId,
  typeId,
  search,
  refreshKey,
  onDayClick,
  onPlanClick,
  onNewPlan
}) => {
  const [days, setDays] = useState<Map<string, Day>>(new Map());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const startDate = dateKey(month.year, month.month, 1);
  const endDate = dateKey(month.year, month.month, daysInMonth);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getDays({
        page: 1,
        limit: 31,
        groupId,
        typeId,
        search,
        startDate,
        endDate
      }),
      getPlans({ groupId, startDate, endDate })
    ])
      .then(([result, monthPlans]) => {
        if (cancelled) return;
        setDays(new Map(result.days.map((d) => [d.date, d])));
        setPlans(monthPlans);
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
    return [...Array.from({ length: leading }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  }, [month.year, month.month, daysInMonth]);

  const plansByDay = useMemo(() => {
    const byDay = new Map<string, Plan[]>();
    // A trip is on every one of its days, not only the first.
    for (const plan of plans) {
      for (let day = plan.date; day <= (plan.endDate ?? plan.date); day = nextDay(day)) {
        byDay.set(day, [...(byDay.get(day) ?? []), plan]);
      }
    }
    return byDay;
  }, [plans]);

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

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 30,
          mb: 1
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {loading
            ? ''
            : `${days.size} day${days.size === 1 ? '' : 's'} logged this month` +
              (plans.length ? ` · ${plans.length} plan${plans.length === 1 ? '' : 's'}` : '')}
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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: { xs: 0.5, sm: 0.75 }
          }}
        >
          {WEEKDAYS.map((name) => (
            <Typography
              key={name}
              variant="caption"
              sx={{
                color: 'text.secondary',
                textAlign: 'center',
                fontWeight: 600
              }}
            >
              {name}
            </Typography>
          ))}

          {cells.map((dayOfMonth, i) => {
            if (dayOfMonth === null) return <Box key={`blank-${i}`} />;
            const date = dateKey(month.year, month.month, dayOfMonth);
            const day = days.get(date);
            const entries = day?.entries ?? [];
            const dayPlans = plansByDay.get(date) ?? [];
            const future = date > today;
            const named = [
              ...entries.map((entry) => ({
                key: entry._id,
                color: entry.type?.color,
                name: entry.type?.name || 'Unknown',
                time: null as string | null,
                planned: false
              })),
              ...dayPlans.map((plan) => ({
                key: plan.id,
                color: plan.type?.color,
                name: plan.title,
                time: plan.time,
                planned: true
              }))
            ];
            const counts = [
              entries.length ? `${entries.length} logged` : '',
              dayPlans.length ? `${dayPlans.length} planned` : ''
            ].filter(Boolean);
            const open = () => {
              if (!future) onDayClick(date);
              else if (dayPlans.length === 1) onPlanClick(dayPlans[0]!);
              else onNewPlan(date);
            };
            const label = new Date(month.year, month.month, dayOfMonth).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            });
            return (
              <ButtonBase
                key={date}
                onClick={open}
                aria-label={counts.length ? `${label}, ${counts.join(', ')}` : label}
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
                  color: future && !dayPlans.length ? 'text.secondary' : 'text.primary',
                  textAlign: 'left',
                  '&:hover': { borderColor: 'primary.main' }
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: date === today ? 700 : 500,
                    color: date === today ? 'primary.main' : 'inherit'
                  }}
                >
                  {dayOfMonth}
                </Typography>

                {named.length > 0 && (
                  <>
                    {/* phones: a dot per entry, a ring per plan */}
                    <Box
                      sx={{
                        display: { xs: 'flex', sm: 'none' },
                        flexWrap: 'wrap',
                        gap: '3px',
                        mt: 0.5
                      }}
                    >
                      {named.map((item) => (
                        <Box
                          key={item.key}
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            boxSizing: 'border-box',
                            ...(item.planned
                              ? {
                                  border: 2,
                                  borderColor: item.color || 'primary.main'
                                }
                              : { bgcolor: item.color || '#9e9e9e' })
                          }}
                        />
                      ))}
                    </Box>
                    {/* wider screens: the first few by name */}
                    <Box
                      sx={{
                        display: { xs: 'none', sm: 'flex' },
                        flexDirection: 'column',
                        gap: 0.25,
                        mt: 0.5
                      }}
                    >
                      {named.slice(0, NAMED_ENTRIES).map((item) => (
                        <Box
                          key={item.key}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            minWidth: 0
                          }}
                        >
                          {item.planned ? (
                            <ScheduleIcon
                              sx={{
                                fontSize: 11,
                                flexShrink: 0,
                                color: item.color || 'primary.main'
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                flexShrink: 0,
                                borderRadius: '50%',
                                bgcolor: item.color || '#9e9e9e'
                              }}
                            />
                          )}
                          <Typography variant="caption" noWrap sx={{ lineHeight: 1.3 }}>
                            {item.time ? `${item.time} ` : ''}
                            {item.name}
                          </Typography>
                        </Box>
                      ))}
                      {named.length > NAMED_ENTRIES && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
                          +{named.length - NAMED_ENTRIES} more
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
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CircularProgress size={32} />
          </Box>
        )}
      </Box>

      {plans.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              letterSpacing: 1.5,
              display: 'block',
              mb: 0.5
            }}
          >
            Plans this month
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {plans.map((plan) => (
              <PlanRow key={plan.id} plan={plan} onClick={onPlanClick} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default JournalCalendar;
