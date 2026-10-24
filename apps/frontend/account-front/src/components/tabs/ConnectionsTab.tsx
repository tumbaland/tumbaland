import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material';
import { LinkOff, Hub } from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import { Connection, connectionService } from '../../services/apiKeyService';

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/**
 * Assistants connected through OAuth.
 *
 * Its own tab rather than a section under API keys, which is where it used to
 * live. The two answer the same question — what can reach my data — but they
 * are not the same thing and they are not managed the same way: a key is a
 * secret someone pasted into a config and may need to read back, while a
 * connection was approved on a consent screen and has no secret to show. Under
 * one heading the page offered a "New key" button above a list of things no key
 * was ever made for, and the only control here, disconnect, sat below two
 * screens of key management.
 *
 * The cross-link at the foot is what keeps the split from hiding one from the
 * other: somebody who came looking for "what can reach my data" has to land on
 * both halves of the answer.
 */
const ConnectionsTab: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setConnections(await connectionService.list());
    } catch (error) {
      logger.error('Failed to load connections', { error });
      setMessage({ type: 'error', text: 'Could not load connected apps.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (connection: Connection) => {
    try {
      await connectionService.revoke(connection.clientId);
      setConnections((current) =>
        current.map((item) =>
          item.clientId === connection.clientId
            ? { ...item, revokedAt: new Date().toISOString() }
            : item
        )
      );
      // Said plainly rather than implying the cut is instant: access tokens are
      // stateless and stay valid until they expire.
      setMessage({
        type: 'success',
        text: `Disconnected ${connection.clientName}. It cannot renew access; anything it already holds stops working within the hour.`
      });
    } catch (error) {
      logger.error('Failed to revoke connection', { error });
      setMessage({ type: 'error', text: 'Could not disconnect that app.' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const active = connections.filter((connection) => !connection.revokedAt);

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
        Connections
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Assistants you approved on a consent screen. Nothing was copied or pasted for these, so
        there is no key to show. The only control is disconnecting.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {active.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
          <Hub sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nothing connected yet. Add Tumbaland as a connector in Claude, or any assistant that takes one.
          </Typography>
          <Link href="/connect" sx={{ fontSize: 14, mt: 1, display: 'inline-block' }}>
            How connecting works
          </Link>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {active.map((connection) => (
            <Paper key={connection.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600 }}>{connection.clientName}</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {(connection.tenants ?? [])
                    .map((tenant) => connection.tenantNames?.[tenant] ?? tenant)
                    .join(' · ') || 'Personal data'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {connection.scopes.map((scope) => (
                  <Chip key={scope} size="small" variant="outlined" label={scope} />
                ))}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Connected {formatDate(connection.createdAt)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Last renewed {formatDate(connection.lastRenewedAt)}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  size="small"
                  color="error"
                  startIcon={<LinkOff />}
                  onClick={() => handleRevoke(connection)}
                >
                  Disconnect
                </Button>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 3 }}>
        Something that cannot sign in — a script, or a tool without a consent screen — needs an{' '}
        <Link href="/account/api-keys">API key</Link> instead.
      </Typography>
    </Box>
  );
};

export default ConnectionsTab;
