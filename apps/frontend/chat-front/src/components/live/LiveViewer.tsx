import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsOutlinedIcon from '@mui/icons-material/DirectionsOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import { chatApi } from '../../services/chatApi';
import {
  DESTINATION_COLOR,
  PERSON_COLOR,
  RADII,
  STALE_MS,
  ageText,
  currentPosition,
  directionsUrl,
  formatDistance,
  kmh
} from '../../services/live';
import type { LiveShare } from '../../types';
import { useNow } from './useNow';
import { placeText, usePlaceAt } from '../../hooks/usePlaceAt';
import { loadLiveMap } from './loadLiveMap';

const LiveMap = lazy(loadLiveMap);

export interface LiveViewerProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  /** The share being watched. */
  share: LiveShare;
  currentUserId: string;
  /** The share as the server answered, after asking to be told or not. */
  onShareChange: (share: LiveShare) => void;
}

/**
 * Someone else's share, for the person waiting: where they are, how old that
 * is, and "tell me when they are close", which is what saves standing at the
 * window. The waiter's own point goes to the server only, never to the sharer.
 */
export function LiveViewer({ open, onClose, conversationId, share, currentUserId, onShareChange }: LiveViewerProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const name = share.name || 'Someone';
  const position = share.position;
  // A pin stays put on purpose, so it is never old.
  const age = position && !share.fixed ? now - new Date(position.at).getTime() : null;
  const mine = share.watchers.find((watcher) => watcher.userId === currentUserId);
  // A pin sent before its address was known is named here instead.
  const pinAddress = usePlaceAt(share.fixed && !share.pinLabel && position ? position : null);
  const pinName = share.pinLabel || (pinAddress && position ? placeText(pinAddress, position) : null);

  const watch = async (radiusM: number) => {
    setBusy(true);
    setError(null);
    try {
      const here = await currentPosition();
      if (!mounted.current) return;
      const updated = await chatApi.watchLive(conversationId, share.userId, {
        lat: here.coords.latitude,
        lng: here.coords.longitude,
        radiusM
      });
      if (mounted.current) onShareChange(updated);
    } catch (cause) {
      setError((cause as { status?: number }).status ? 'Could not set that up. Try again.' : (cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unwatch = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await chatApi.unwatchLive(conversationId, share.userId);
      if (mounted.current) onShareChange(updated);
    } catch {
      setError('Could not change that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: phone ? undefined : { height: 'min(86vh, 720px)' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: surface.default }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            pt: 'calc(8px + env(safe-area-inset-top))'
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ fontSize: 18 }}>
              {name}
              {share.fixed && pinName ? `: ${pinName}` : ''}
              {mine?.distanceM !== null && mine?.distanceM !== undefined
                ? ` · ${formatDistance(mine.distanceM)} away`
                : ''}
            </Typography>
            <Typography
              variant="caption"
              role="status"
              sx={{ color: age !== null && age > STALE_MS ? 'error.main' : ink.muted }}
            >
              {[
                !position
                  ? 'Waiting for the first position'
                  : share.fixed
                    ? `Pin shared ${ageText(position.at, now)}`
                    : `Updated ${ageText(position.at, now)}`,
                share.destination?.distanceM !== null && share.destination?.distanceM !== undefined
                  ? `${formatDistance(share.destination.distanceM)} to ${share.destination.label || 'go'}`
                  : null,
                position?.speed && position.speed > 1 ? `${kmh(position.speed)} km/h` : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
          <IconButton aria-label="Close map" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, position: 'relative', bgcolor: surface.sunken }}>
          {position ? (
            <Suspense
              fallback={
                <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              }
            >
              <LiveMap
                points={[
                  {
                    id: share.userId,
                    ...position,
                    color: PERSON_COLOR,
                    label: pinName || name,
                    kind: share.fixed ? 'place' : 'person'
                  },
                  ...(share.destination
                    ? [
                        {
                          id: 'destination',
                          lat: share.destination.lat,
                          lng: share.destination.lng,
                          color: DESTINATION_COLOR,
                          label: share.destination.label || 'Destination',
                          kind: 'place' as const
                        }
                      ]
                    : [])
                ]}
              />
            </Suspense>
          ) : (
            <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          )}
        </Box>

        <Box sx={{ px: 2, pt: 1.5, pb: 'calc(16px + env(safe-area-inset-bottom))', display: 'grid', gap: 1 }}>
          {age !== null && age > STALE_MS && (
            <Alert severity="warning" sx={{ py: 0 }}>
              Not updated for {ageText(position!.at, now).replace(' ago', '')}. {name}&apos;s screen may be off.
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ py: 0 }}>
              {error}
            </Alert>
          )}

          {mine ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsActiveOutlinedIcon sx={{ color: brand.pinkInk }} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {mine.notified
                  ? `${name} is close`
                  : `You get a notification when ${name} is ${formatDistance(mine.radiusM)} away`}
              </Typography>
              <Button size="small" onClick={() => void unwatch()} disabled={busy}>
                {mine.notified ? 'Done' : 'Cancel'}
              </Button>
            </Box>
          ) : !share.fixed ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Tell me when {name} is this close to where I am now
              </Typography>
              <Box role="group" aria-label="How close" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {RADII.map((radius) => (
                  <Chip
                    key={radius}
                    label={formatDistance(radius)}
                    onClick={() => void watch(radius)}
                    disabled={busy}
                    variant="outlined"
                  />
                ))}
                {busy && <CircularProgress size={20} sx={{ alignSelf: 'center' }} />}
              </Box>
            </Box>
          ) : null}

          {/* A pin is somewhere to go and get someone: the way there is the next thing wanted. */}
          {share.fixed && position && (
            <Button
              variant="contained"
              size="large"
              href={directionsUrl(position)}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<DirectionsOutlinedIcon />}
            >
              Get directions
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
