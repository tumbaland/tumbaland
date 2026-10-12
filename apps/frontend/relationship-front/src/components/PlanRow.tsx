import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { Plan } from '../services/types';

/** "Fri 16 Oct" */
const shortDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

/** One plan as a tappable row: what, when, where, and a bell while a reminder is pending. */
const PlanRow: React.FC<{ plan: Plan; onClick: (plan: Plan) => void }> = ({ plan, onClick }) => (
  <ButtonBase
    onClick={() => onClick(plan)}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 1.25,
      p: 1.25,
      borderRadius: 2,
      border: 1,
      borderColor: 'divider',
      textAlign: 'left',
      width: '100%',
      '&:hover': { borderColor: 'primary.main' }
    }}
  >
    <ScheduleIcon sx={{ fontSize: 18, color: plan.type?.color || 'primary.main' }} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
        {plan.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {shortDay(plan.date)}
        {plan.time ? ` at ${plan.time}` : ''}
        {plan.endDate ? ` to ${shortDay(plan.endDate)}` : plan.time ? '' : ', all day'}
        {plan.location ? ` · ${plan.location.label}` : ''}
        {plan.loggedActivityId ? ' · in the journal' : ''}
      </Typography>
    </Box>
    {plan.remindAt && !plan.remindedAt && (
      <NotificationsActiveOutlinedIcon aria-label="Reminder set" sx={{ fontSize: 16, color: 'text.secondary' }} />
    )}
  </ButtonBase>
);

export default PlanRow;
