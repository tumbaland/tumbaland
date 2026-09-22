import Avatar from '@mui/material/Avatar';
import { brand } from '@tumbaland/frontend-core';

export interface MemberAvatarProps {
  name: string;
  picture?: string | null;
  size: number;
}

/**
 * A member's picture, or their initial on a coloured disc when they have none.
 *
 * Decorative: it always sits beside the name it stands for, so it is hidden
 * from screen readers rather than announced a second time.
 */
export function MemberAvatar({ name, picture, size }: MemberAvatarProps) {
  return (
    <Avatar
      src={picture || undefined}
      alt=""
      aria-hidden
      // The picture is served from another origin with no cookies needed, and
      // this keeps the request from carrying any.
      slotProps={{ img: { referrerPolicy: 'no-referrer', loading: 'lazy' } }}
      sx={{ width: size, height: size, fontSize: size * 0.45, bgcolor: brand.pinkInk, flexShrink: 0 }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </Avatar>
  );
}
