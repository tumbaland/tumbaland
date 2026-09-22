import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsOffOutlinedIcon from '@mui/icons-material/NotificationsOffOutlined';
import { ink } from '@tumbaland/frontend-core';
import {
  disableNotifications,
  enableNotifications,
  pushSupport,
  type PushSupport
} from '../services/pushNotifications';

/**
 * The notification toggle, in the account menu.
 *
 * It exists as a *control the person operates* rather than a prompt on load for
 * two reasons: iOS refuses a permission request that does not come from a user
 * gesture, and Chrome holds asking-on-load against the site's permission
 * standing. Tapping this switch is the gesture.
 *
 * Each unsupported case says what it actually is. "Not supported" on an iPhone
 * would be wrong and unhelpful: Web Push works there, but only once the site is
 * on the Home Screen.
 */

const EXPLANATION: Record<Exclude<PushSupport, 'ready' | 'needs-permission'>, string> = {
  'needs-install': 'Add Tumbaland to your Home Screen first, then turn this on from there.',
  denied: 'Notifications are blocked. Enable them in your device or browser notification settings.',
  unsupported: 'This browser cannot show notifications.'
};

export function NotificationSetting() {
  const [support, setSupport] = useState<PushSupport>('unsupported');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = pushSupport();
    setSupport(state);
    if (state !== 'ready') return;

    // Permission being granted is not the same as a live subscription: the
    // person may have turned this off, or the browser may have dropped it.
    let active = true;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => active && setEnabled(Boolean(subscription)))
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disableNotifications();
        setEnabled(false);
      } else {
        const result = await enableNotifications();
        setSupport(result);
        setEnabled(result === 'ready');
      }
    } catch (error) {
      setError((error as Error).message || 'Could not change notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const unavailable = support !== 'ready' && support !== 'needs-permission';

  return (
    <MenuItem
      onClick={unavailable || busy ? undefined : toggle}
      disabled={unavailable || busy}
      sx={{ borderRadius: 2, mx: 0.5, alignItems: 'flex-start', '&.Mui-disabled': { opacity: 1 } }}
    >
      <ListItemIcon sx={{ color: 'inherit', mt: 0.5 }}>
        {enabled ? (
          <NotificationsActiveOutlinedIcon fontSize="small" />
        ) : (
          <NotificationsOffOutlinedIcon fontSize="small" />
        )}
      </ListItemIcon>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ListItemText primary="Message notifications" sx={{ my: 0 }} />
        {error && <Typography role="alert" variant="caption" color="error" sx={{ whiteSpace: 'normal' }}>{error}</Typography>}
        {unavailable && (
          <Typography variant="caption" sx={{ color: ink.muted, display: 'block', whiteSpace: 'normal' }}>
            {EXPLANATION[support]}
          </Typography>
        )}
      </Box>

      {!unavailable && (
        <Switch
          edge="end"
          checked={enabled}
          disabled={busy}
          slotProps={{ input: { 'aria-label': 'Message notifications' } }}
          // The MenuItem's own click does the work; without this the switch
          // toggles twice and lands back where it started.
          onClick={(event) => event.preventDefault()}
        />
      )}
    </MenuItem>
  );
}
