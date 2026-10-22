import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import { STALE_MS, ageText, formatDistance } from '../../services/live';
import type { LiveShare } from '../../types';
import { useNow } from './useNow';

export interface LiveBannerProps {
  shares: LiveShare[];
  currentUserId: string;
  /** True while this phone is sending the caller's own share. */
  sending: boolean;
  onOpenOwn: () => void;
  onStopOwn: () => void;
  onOpenOther: (userId: string) => void;
}

/**
 * The line under the thread's header while someone is sharing where they are,
 * so it is seen without opening anything: who, how far, and how fresh.
 */
export function LiveBanner({ shares, currentUserId, sending, onOpenOwn, onStopOwn, onOpenOther }: LiveBannerProps) {
  const now = useNow(5000);
  const live = shares.filter((share) => new Date(share.endsAt).getTime() > now);
  if (live.length === 0) return null;

  return (
    <Box sx={{ borderBottom: `1px solid ${surface.sunken}`, bgcolor: surface.paper }}>
      {live.map((share) => {
        const own = share.userId === currentUserId;
        const at = share.position?.at;
        // A pin stays put on purpose, so it is never old.
        const stale = at && !share.fixed ? now - new Date(at).getTime() > STALE_MS : false;
        const mine = share.watchers.find((watcher) => watcher.userId === currentUserId);
        const line = own
          ? share.fixed
            ? 'You shared a pin of where you are'
            : sending
              ? 'You are sharing where you are'
              : 'You are sharing, but this phone is not sending'
          : [
              share.fixed
                ? `${share.name || 'Someone'} shared a pin${share.pinLabel ? `: ${share.pinLabel}` : ''}`
                : `${share.name || 'Someone'} is sharing live`,
              // How far from the one reading, when they said where they are; else how far from the destination.
              mine?.distanceM !== null && mine?.distanceM !== undefined
                ? `${formatDistance(mine.distanceM)} away`
                : share.destination?.distanceM !== null && share.destination?.distanceM !== undefined
                  ? `${formatDistance(share.destination.distanceM)} to ${share.destination.label || 'go'}`
                  : null,
              at ? ageText(at, now) : null
            ]
              .filter(Boolean)
              .join(' · ');

        return (
          <Box
            key={share.userId}
            role="status"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 1, py: 0.5 }}
          >
            <NearMeOutlinedIcon sx={{ fontSize: 18, color: brand.pinkInk }} />
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0, color: (own && !sending && !share.fixed) || stale ? 'error.main' : ink.body }}
            >
              {line}
            </Typography>
            {own ? (
              <>
                <Button size="small" onClick={onOpenOwn}>
                  Open
                </Button>
                <Button size="small" color="error" onClick={onStopOwn}>
                  Stop
                </Button>
              </>
            ) : (
              <Button size="small" onClick={() => onOpenOther(share.userId)}>
                Map
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
