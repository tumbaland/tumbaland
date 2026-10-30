import Avatar from '@mui/material/Avatar';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export interface BotAvatarProps {
  color: string;
  size: number;
}

/**
 * An assistant's picture: its colour with a sparkle, which no member's initial
 * ever looks like. Decorative, like a member's: it sits beside the name.
 */
export function BotAvatar({ color, size }: BotAvatarProps) {
  return (
    <Avatar alt="" aria-hidden sx={{ width: size, height: size, bgcolor: color, color: '#fff', flexShrink: 0 }}>
      <AutoAwesomeIcon sx={{ fontSize: size * 0.58 }} />
    </Avatar>
  );
}
