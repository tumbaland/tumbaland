import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';
import { APP_VERSION, RECENT_NOTES, groupByDate } from '../config/releaseNotes';

export interface WhatsNewDialogProps {
  open: boolean;
  onClose: () => void;
}

const DAYS = groupByDate(RECENT_NOTES);

/** "2026-10-03" as a date in the person's own format, read as local time so it cannot slip a day. */
function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * What changed, newest first, each under the day it went out.
 *
 * A dialog rather than a page: it opens from the account menu, from the update
 * prompt and from the dot, and none of them should move the person off what
 * they were doing.
 */
export function WhatsNewDialog({ open, onClose }: WhatsNewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" scroll="paper" aria-labelledby="whats-new-title">
      <DialogTitle id="whats-new-title" sx={{ fontWeight: 700 }}>
        What's new
      </DialogTitle>
      <DialogContent dividers>
        {DAYS.map((day) => (
          <Box key={day.date} component="section" sx={{ '& + &': { mt: 2.5 } }}>
            <Typography component="h3" sx={{ fontSize: 13, fontWeight: 700, color: ink.muted, mb: 0.75 }}>
              {formatDate(day.date)}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: ink.body, fontSize: 15, lineHeight: 1.5 }}>
              {day.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
        <Typography sx={{ fontSize: 12.5, color: ink.muted }}>Tumbaland {APP_VERSION}</Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default WhatsNewDialog;
