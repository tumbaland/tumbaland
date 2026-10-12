import { Box, ButtonBase, Typography } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { glass, ink, moduleAccent, surface } from '@tumbaland/frontend-core';
import { SectionLabel } from './SectionLabel';
import { localToday, type HomePlan } from '../../services/homeApi';

interface HomePlansProps {
  plans: HomePlan[];
  onOpen: (route: string) => void;
}

const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const shortDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * When a plan is, from today: "Today at 19:00", "Tomorrow", "Fri at 19:00"
 * within the week, then the date. A trip already under way says when it ends.
 */
export function whenLabel(plan: HomePlan, today: string = localToday()): string {
  const at = plan.time ? ` at ${plan.time}` : '';
  if (plan.date < today && plan.endDate && plan.endDate >= today) return `Until ${weekday(plan.endDate)}`;
  const days = dayNumber(plan.date) - dayNumber(today);
  if (days <= 0) return `Today${at}`;
  if (days === 1) return `Tomorrow${at}`;
  if (days < 7) return `${weekday(plan.date)}${at}`;
  return shortDate(plan.date);
}

/**
 * The next few plans on the home page. Tapping one opens it on the journal's
 * calendar. Renders nothing while nothing is planned, so the page is as it was
 * for anyone who never makes a plan.
 */
export function HomePlans({ plans, onOpen }: HomePlansProps) {
  if (plans.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="home-plans">
      <SectionLabel id="home-plans">Plans</SectionLabel>
      <Box sx={{ ...glass, overflow: 'hidden' }}>
        {plans.map((plan, index) => (
          <ButtonBase
            key={plan.id}
            onClick={() => onOpen(`/relationship/journal?view=calendar&plan=${encodeURIComponent(plan.id)}`)}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: { xs: 1.75, md: 2.25 },
              py: 1.25,
              textAlign: 'left',
              borderTop: index === 0 ? 'none' : `1px solid ${surface.divider}`,
              WebkitTapHighlightColor: 'transparent',
              '&:hover, &:active': { background: surface.hover }
            }}
          >
            <ScheduleIcon sx={{ fontSize: 18, flexShrink: 0, color: plan.type?.color || moduleAccent.journal }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600, color: ink.strong }}>
                {plan.title}
              </Typography>
              {plan.location && (
                <Typography noWrap sx={{ fontSize: '0.8rem', color: ink.muted }}>
                  {plan.location.label}
                </Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.8rem', color: ink.muted, flexShrink: 0 }}>{whenLabel(plan)}</Typography>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
