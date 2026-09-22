import type { ReactNode } from 'react';
import Badge from '@mui/material/Badge';

/** The green of "online": clear against both a photo and the page. */
export const ONLINE_GREEN = '#16a34a';

export interface PresenceDotProps {
  online: boolean;
  /** The avatar's size, which the dot scales with. */
  size: number;
  children: ReactNode;
}

/** A small green dot on the corner of an avatar while that person is online. */
export function PresenceDot({ online, size, children }: PresenceDotProps) {
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <Badge
      variant="dot"
      overlap="circular"
      invisible={!online}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{
        flexShrink: 0,
        '& .MuiBadge-dot': {
          width: dot,
          height: dot,
          minWidth: dot,
          borderRadius: '50%',
          bgcolor: ONLINE_GREEN,
          // A ring in the page colour, so the dot reads as sitting on the avatar.
          boxShadow: '0 0 0 2px #fff'
        }
      }}
    >
      {children}
    </Badge>
  );
}
