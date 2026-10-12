import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { ink } from '@tumbaland/frontend-core';
import type { ThreadMessage } from '../../types';

export interface ReminderCardProps {
  message: ThreadMessage;
  onOpen: (planId: string) => void;
}

/** "Friday 16 October", the plan's own calendar day whatever zone the phone is in. */
const longDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

/** "Friday 16 October at 19:00", or "Friday 16 October to Sunday 18 October" for a trip. */
export function planWhen(date: string, time: string | null, endDate?: string | null): string {
  const start = time ? `${longDay(date)} at ${time}` : longDay(date);
  return endDate ? `${start} to ${longDay(endDate)}` : start;
}

/**
 * A plan from the journal is coming up. Posted by the app, not by either of
 * you, so it sits in the middle of the thread like the collage card, with a
 * way into the calendar where the plan is.
 */
export function ReminderCard({ message, onOpen }: ReminderCardProps) {
  const plan = message.plan;
  if (!plan) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5, px: 2 }}>
      <Box
        data-testid="reminder-card"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          maxWidth: 360,
          width: '100%',
          p: 1.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider'
        }}
      >
        <NotificationsActiveOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {plan.title}
          </Typography>
          <Typography variant="caption" component="div" sx={{ color: ink.muted }}>
            {planWhen(plan.date, plan.time, plan.endDate)}
            {plan.place ? ` · ${plan.place}` : ''}
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={() => onOpen(plan.id)}>
          Open
        </Button>
      </Box>
    </Box>
  );
}
