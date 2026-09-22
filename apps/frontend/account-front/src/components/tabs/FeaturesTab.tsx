import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Switch, Typography } from '@mui/material';
import { AttachMoney } from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import { featuresService, type Features } from '../../services/features';

/**
 * The parts of Tumbaland each person turns on for themselves.
 *
 * Money lives here rather than in the menu by default: it is one person's own
 * finances, and the app is shared with someone else. Turning it on adds Money
 * to your menu and nobody else's.
 */
const FeaturesTab: React.FC = () => {
  const [features, setFeatures] = useState<Features | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    featuresService
      .get()
      .then((value) => active && setFeatures(value))
      .catch((cause) => {
        logger.error('Failed to load features', { error: cause });
        if (active) setError('Could not load your features.');
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleMoney = async () => {
    if (!features) return;
    setBusy(true);
    setError(null);
    try {
      setFeatures(await featuresService.setShowMoney(!features.showMoney));
    } catch (cause) {
      logger.error('Failed to change a feature', { error: cause });
      setError('Could not change that. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        Features
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Turn on the parts of Tumbaland you want in your menu. These are only for you.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!features && !error ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        features && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <AttachMoney sx={{ color: 'success.main' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }}>Money</Typography>
              <Typography variant="body2" color="text.secondary">
                Net worth, cash flow and investments. Adds Money to your menu.
              </Typography>
            </Box>
            <Switch
              checked={features.showMoney}
              disabled={busy}
              onChange={() => void toggleMoney()}
              slotProps={{ input: { 'aria-label': 'Money' } }}
            />
          </Paper>
        )
      )}
    </Box>
  );
};

export default FeaturesTab;
