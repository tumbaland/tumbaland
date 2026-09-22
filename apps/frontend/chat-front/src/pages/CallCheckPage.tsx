import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { ink } from '@tumbaland/frontend-core';
import { chatApi } from '../services/chatApi';
import { canCheck, checkRoutes, type ConnectionRoutes } from '../services/connectionCheck';

/**
 * Whether calls can connect from the network this phone is on.
 *
 * Not linked from anywhere: it is for trying on each phone, on Wi-Fi and on
 * mobile data, before calls exist, and for finding out why one did not connect
 * once they do.
 */

type Result = ConnectionRoutes & { relayConfigured: boolean };

const ROUTES: Array<{ key: keyof ConnectionRoutes; label: string; hint: string }> = [
  { key: 'local', label: 'Same Wi-Fi', hint: 'When you are both at home' },
  { key: 'internet', label: 'Across the internet', hint: 'Between most home networks' },
  { key: 'relay', label: 'Through the relay', hint: 'From mobile data, and anywhere else' }
];

/** One line on what the result means for a call. */
export function verdict(result: Result): { severity: 'success' | 'warning' | 'error'; text: string } {
  if (result.relay) return { severity: 'success', text: 'Calls will connect from here.' };
  if (!result.relayConfigured) {
    return {
      severity: 'warning',
      text: 'The relay is not set up yet, so calls from mobile data may not connect.'
    };
  }
  if (result.internet) {
    return {
      severity: 'warning',
      text: 'The relay cannot be reached from this network. Calls may fail when one of you is on mobile data.'
    };
  }
  return { severity: 'error', text: 'Calls will not connect from this network.' };
}

export default function CallCheckPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const config = await chatApi.iceServers();
      const routes = await checkRoutes(config.iceServers);
      setResult({ ...routes, relayConfigured: config.relay });
    } catch {
      setError('Could not run the check. Are you online?');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (canCheck()) void run();
  }, [run]);

  const outcome = result ? verdict(result) : null;

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', px: 2, py: 3 }}>
      <Typography variant="h6" gutterBottom>
        Can calls connect?
      </Typography>
      <Typography variant="body2" sx={{ color: ink.muted, mb: 3 }}>
        Try this on each phone, once on Wi-Fi and once on mobile data.
      </Typography>

      {!canCheck() && <Alert severity="error">This browser cannot make calls.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      {checking && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Checking this network…</Typography>
        </Box>
      )}

      {result && outcome && (
        <>
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 3 }}>
            {ROUTES.map(({ key, label, hint }) => (
              <Box component="li" key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                {result[key] ? (
                  <CheckCircleIcon color="success" titleAccess="Works" />
                ) : (
                  <CancelIcon sx={{ color: ink.muted }} titleAccess="Does not work" />
                )}
                <Box>
                  <Typography variant="body1">
                    {label}: {result[key] ? 'works' : 'no'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: ink.muted }}>
                    {hint}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Alert severity={outcome.severity} sx={{ mb: 3 }}>
            {outcome.text}
          </Alert>
        </>
      )}

      {canCheck() && !checking && (
        <Button variant="outlined" onClick={() => void run()}>
          Check again
        </Button>
      )}
    </Box>
  );
}
