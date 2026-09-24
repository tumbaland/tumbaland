import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import { ink } from '@tumbaland/frontend-core';
import type { ThreadMessage } from '../../types';
import { clockTime } from './clock';

export interface CollageCardProps {
  message: ThreadMessage;
  mine: boolean;
  onJoin: (collageId: string) => void;
}

/**
 * "Tom started a collage", with a Join button that opens it in Album.
 *
 * Centred like a line saying what changed, because it is about the chat rather
 * than something one person said, but a card, because it is something to do.
 */
export function CollageCard({ message, mine, onJoin }: CollageCardProps) {
  const collage = message.collage;
  if (!collage) return null;
  const who = mine ? 'You' : message.senderName || 'Someone';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5, px: 2 }}>
      <Box
        data-testid="collage-card"
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
        <DashboardOutlinedIcon sx={{ color: ink.muted }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {collage.title}
          </Typography>
          <Typography variant="caption" sx={{ color: ink.muted }}>
            {who} started a collage · {clockTime(message.createdAt)}
          </Typography>
        </Box>
        <Button variant="contained" size="small" disableElevation onClick={() => onJoin(collage.id)}>
          {mine ? 'Open' : 'Join'}
        </Button>
      </Box>
    </Box>
  );
}
