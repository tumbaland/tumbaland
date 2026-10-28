import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material';
import { Add, Key as KeyIcon } from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import { ApiKey, CreatedApiKey, PERSONAL_TENANT, apiKeyService } from '../../services/apiKeyService';
import { ApiKeyCard } from './ApiKeyCard';
import { CreateApiKeyDialog, type TenantOption } from './CreateApiKeyDialog';
import { getUserGroups } from '../../services/groupService';

/**
 * API keys let an agent — Claude, ChatGPT, a script — act on your data without a
 * browser sign-in.
 *
 * Keys are shown again on demand rather than only once at creation. That is a
 * deliberate trade against the usual advice: it costs the guarantee that a
 * database dump contains no usable credential, and buys not having to revoke and
 * re-wire a key every time one is misplaced. The reveal is a POST, rate-limited
 * and audited server-side, and never leaves a token in a URL.
 */
const ApiKeysTab: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [groups, setGroups] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tokens revealed this session, by key id. Held only in component state, so
  // closing the tab forgets them.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  /** Everything this person could grant a key, personal first. */
  const tenantOptions: TenantOption[] = [
    { id: PERSONAL_TENANT, name: 'My own data' },
    ...groups
  ];

  const tenantName = (id: string): string =>
    tenantOptions.find((option) => option.id === id)?.name ??
    (id === PERSONAL_TENANT ? 'Personal' : 'Group');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setKeys(await apiKeyService.list());
    } catch (error) {
      logger.error('Failed to load API keys', { error });
      setMessage({ type: 'error', text: 'Could not load your API keys.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Groups are a convenience, not a requirement: if the group service is
  // unreachable the tab still works and every key is simply personal.
  useEffect(() => {
    getUserGroups()
      .then((found) => setGroups(found.map((group) => ({ id: group._id, name: group.name }))))
      .catch((error) => logger.warn('Could not load groups for key scoping', { error }));
  }, []);

  const handleCreated = (created: CreatedApiKey) => {
    // The create response carries the token, so it starts out visible without
    // spending a reveal.
    setRevealed((current) => ({ ...current, [created.id]: created.token }));
    setKeys((current) => [created, ...current]);
    setCreateOpen(false);
    setMessage({ type: 'success', text: `Created “${created.name}”.` });
  };

  const handleToggleReveal = async (key: ApiKey) => {
    if (revealed[key.id]) {
      setRevealed(({ [key.id]: _hidden, ...rest }) => rest);
      return;
    }

    try {
      setRevealing(key.id);
      const token = await apiKeyService.reveal(key.id);
      setRevealed((current) => ({ ...current, [key.id]: token }));
    } catch (error) {
      logger.error('Failed to reveal API key', { error });
      setMessage({ type: 'error', text: 'Could not reveal the key.' });
    } finally {
      setRevealing(null);
    }
  };

  const handleCopy = async (key: ApiKey) => {
    const token = revealed[key.id];
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setMessage({ type: 'success', text: 'Key copied to clipboard.' });
    } catch (error) {
      logger.error('Clipboard write failed', { error });
      setMessage({ type: 'error', text: 'Could not copy — select and copy manually.' });
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    try {
      const updated = await apiKeyService.revoke(key.id);
      setKeys((current) => current.map((item) => (item.id === key.id ? updated : item)));
      setMessage({ type: 'success', text: `Revoked “${key.name}”. Anything using it stops working now.` });
    } catch (error) {
      logger.error('Failed to revoke API key', { error });
      setMessage({ type: 'error', text: 'Could not revoke the key.' });
    }
  };

  const handleDelete = async (key: ApiKey) => {
    try {
      await apiKeyService.remove(key.id);
      setKeys((current) => current.filter((item) => item.id !== key.id));
      setMessage({ type: 'success', text: `Deleted “${key.name}”.` });
    } catch (error) {
      logger.error('Failed to delete API key', { error });
      setMessage({ type: 'error', text: 'Could not delete the key.' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            API keys
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            A secret you paste into something that cannot sign in as you, like a script or a
            tool with no consent screen.
          </Typography>
        </Box>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>
          New key
        </Button>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {keys.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <KeyIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ color: 'text.secondary' }}>
            No keys yet. Create one to connect Tumbaland to an assistant.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {keys.map((key) => (
            <ApiKeyCard
              key={key.id}
              apiKey={key}
              token={revealed[key.id]}
              revealing={revealing === key.id}
              tenantName={tenantName}
              onToggleReveal={handleToggleReveal}
              onCopy={handleCopy}
              onRevoke={handleRevoke}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}

      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 3 }}>
        Claude does not need one, and nor does anything else that takes an MCP connector. They
        connect by approving a consent screen, and appear under{' '}
        <Link href="/account/connections">Connections</Link>.
      </Typography>

      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantOptions={tenantOptions}
        onCreated={handleCreated}
        onError={(text) => setMessage({ type: 'error', text })}
      />
    </Box>
  );
};

export default ApiKeysTab;
