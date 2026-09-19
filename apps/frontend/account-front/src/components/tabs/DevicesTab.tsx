import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { Devices, Logout } from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import { Device, deviceService } from '../../services/deviceService';

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const countryName = (code: string | null): string | null => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

const HOW_SIGNED_IN: Record<Device['method'], string> = {
  google: 'Signed in with Google',
  unknown: 'Signed in before devices were listed'
};

/**
 * Every device signed in to this account, so one you do not recognise stands
 * out, and a way to sign it out. Signing a device out ends its session on the
 * server, so it stops working on its next request, in every part of the app.
 */
const DevicesTab: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setDevices(await deviceService.list());
    } catch (error) {
      logger.error('Failed to load devices', { error });
      setMessage({ type: 'error', text: 'Could not load your devices.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOut = async (device: Device) => {
    setBusy(true);
    try {
      const signedOutHere = await deviceService.signOut(device.id);
      if (signedOutHere) {
        window.location.reload();
        return;
      }
      setDevices((current) => current.filter((item) => item.id !== device.id));
      setMessage({ type: 'success', text: `Signed out ${device.device}.` });
    } catch (error) {
      logger.error('Failed to sign out device', { error });
      setMessage({ type: 'error', text: 'Could not sign out that device.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutOthers = async () => {
    setBusy(true);
    try {
      const count = await deviceService.signOutOthers();
      setDevices((current) => current.filter((item) => item.current));
      setMessage({
        type: 'success',
        text: count === 1 ? 'Signed out 1 other device.' : `Signed out ${count} other devices.`
      });
    } catch (error) {
      logger.error('Failed to sign out other devices', { error });
      setMessage({ type: 'error', text: 'Could not sign out your other devices.' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const others = devices.filter((device) => !device.current);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Devices
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {others.length > 0 && (
          <Button size="small" color="error" startIcon={<Logout />} onClick={handleSignOutOthers} disabled={busy}>
            Sign out all other devices
          </Button>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Where your account is signed in. If you see a device you don't recognise, sign it out. It stops
        working straight away.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {devices.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
          <Devices sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No devices to show yet. They appear here the next time each one opens Tumbaland.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {devices.map((device) => {
            const country = countryName(device.country);
            return (
              <Paper key={device.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 600 }}>{device.device}</Typography>
                  {device.current && <Chip size="small" color="primary" label="This device" />}
                  <Box sx={{ flexGrow: 1 }} />
                  {country && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {country}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Last active {formatDateTime(device.lastSeenAt)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {HOW_SIGNED_IN[device.method]} {formatDateTime(device.createdAt)}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Logout />}
                    onClick={() => handleSignOut(device)}
                    disabled={busy}
                  >
                    {device.current ? 'Sign out' : 'Sign out device'}
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default DevicesTab;
