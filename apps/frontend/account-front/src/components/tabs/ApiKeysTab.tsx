import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add,
  ContentCopy,
  DeleteForever,
  Block,
  Visibility,
  VisibilityOff,
  Key as KeyIcon
} from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import {
  API_KEY_SCOPES,
  ApiKey,
  ApiKeyScope,
  PERSONAL_TENANT,
  apiKeyService
} from '../../services/apiKeyService';
import { getUserGroups } from '../../services/groupService';
import ConnectionsSection from './ConnectionsSection';

interface TenantOption {
  id: string;
  name: string;
}

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const isRevoked = (key: ApiKey): boolean => Boolean(key.revokedAt);

const isExpired = (key: ApiKey): boolean =>
  Boolean(key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now());

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
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['relationship:read', 'relationship:write']);
  // Both halves of a tenant grant. `tenants` is everything the key may reach;
  // `defaultTenant` is what it uses when a call does not say. The default is
  // always folded into the set on submit, so a key can never be created that
  // reaches nothing and then fails every call it makes.
  const [tenants, setTenants] = useState<string[]>([PERSONAL_TENANT]);
  const [defaultTenant, setDefaultTenant] = useState<string>(PERSONAL_TENANT);
  const [creating, setCreating] = useState(false);

  /** Everything this person could grant a key, personal first. */
  const tenantOptions: TenantOption[] = [
    { id: PERSONAL_TENANT, name: 'My own data' },
    ...groups
  ];

  const tenantName = (id: string): string =>
    tenantOptions.find((option) => option.id === id)?.name ??
    (id === PERSONAL_TENANT ? 'Personal' : 'Group');

  const toggleTenant = (id: string) =>
    setTenants((current) =>
      current.includes(id) ? current.filter((tenant) => tenant !== id) : [...current, id]
    );

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
    load();
  }, [load]);

  // Groups are a convenience, not a requirement: if the group service is
  // unreachable the tab still works and every key is simply personal.
  useEffect(() => {
    getUserGroups()
      .then((found) => setGroups(found.map((group) => ({ id: group._id, name: group.name }))))
      .catch((error) => logger.warn('Could not load groups for key scoping', { error }));
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const created = await apiKeyService.create({
        name: name.trim(),
        scopes,
        tenants: [...new Set([defaultTenant, ...tenants])],
        defaultTenant
      });

      // The create response carries the token, so it starts out visible without
      // spending a reveal.
      setRevealed((current) => ({ ...current, [created.id]: created.token }));
      setKeys((current) => [created, ...current]);
      setCreateOpen(false);
      setName('');
      setMessage({ type: 'success', text: `Created “${created.name}”.` });
    } catch (error) {
      logger.error('Failed to create API key', { error });
      setMessage({ type: 'error', text: 'Could not create the key.' });
    } finally {
      setCreating(false);
    }
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

  const toggleScope = (scope: ApiKeyScope) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );

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
            Let an assistant read or write your data without signing in as you.
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
          {keys.map((key) => {
            const token = revealed[key.id];
            const dead = isRevoked(key) || isExpired(key);

            return (
              <Paper
                key={key.id}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2, opacity: dead ? 0.6 : 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{key.name}</Typography>
                  {isRevoked(key) && <Chip size="small" color="error" label="Revoked" />}
                  {!isRevoked(key) && isExpired(key) && <Chip size="small" color="warning" label="Expired" />}
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {(key.tenants ?? []).map(tenantName).join(' · ') || 'Personal'}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    overflowX: 'auto'
                  }}
                >
                  <Box component="span" sx={{ flexGrow: 1, whiteSpace: 'nowrap' }}>
                    {token ?? `${key.prefix}${'•'.repeat(24)}`}
                  </Box>

                  <Tooltip title={token ? 'Hide key' : 'Show key'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={token ? `Hide ${key.name}` : `Show ${key.name}`}
                        onClick={() => handleToggleReveal(key)}
                        disabled={revealing === key.id}
                      >
                        {revealing === key.id ? (
                          <CircularProgress size={18} />
                        ) : token ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip title={token ? 'Copy key' : 'Show the key first'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Copy ${key.name}`}
                        onClick={() => handleCopy(key)}
                        disabled={!token}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1.5 }}>
                  {key.scopes.map((scope) => (
                    <Chip key={scope} size="small" variant="outlined" label={scope} />
                  ))}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Created {formatDate(key.createdAt)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Last used {formatDate(key.lastUsedAt)}
                  </Typography>
                  {key.expiresAt && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Expires {formatDate(key.expiresAt)}
                    </Typography>
                  )}
                  <Box sx={{ flexGrow: 1 }} />

                  {!isRevoked(key) && (
                    <Button
                      size="small"
                      color="warning"
                      startIcon={<Block />}
                      onClick={() => handleRevoke(key)}
                    >
                      Revoke
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteForever />}
                    onClick={() => handleDelete(key)}
                  >
                    Delete
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      )}

      <ConnectionsSection />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New API key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            placeholder="Claude Code"
            value={name}
            onChange={(event) => setName(event.target.value)}
            helperText="So you can tell your keys apart later."
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
            Acts on
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Tick everything this key may reach. Granting more than one means the assistant can
            work across them without a second key.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
            {tenantOptions.map((option) => (
              <FormControlLabel
                key={option.id}
                control={
                  <Checkbox
                    checked={tenants.includes(option.id) || defaultTenant === option.id}
                    // The default is always part of the grant, so its box is
                    // shown ticked and cannot be the one that empties the set.
                    disabled={defaultTenant === option.id}
                    onChange={() => toggleTenant(option.id)}
                  />
                }
                label={option.name}
              />
            ))}
          </Box>

          <FormControl fullWidth margin="dense">
            <InputLabel id="api-key-default-tenant-label">Use by default</InputLabel>
            <Select
              labelId="api-key-default-tenant-label"
              label="Use by default"
              value={defaultTenant}
              onChange={(event) => setDefaultTenant(event.target.value)}
            >
              {tenantOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
            Permissions
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Grant only what the assistant needs. This cannot be changed afterwards.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
            {API_KEY_SCOPES.map((scope) => (
              <FormControlLabel
                key={scope.value}
                control={
                  <Checkbox
                    checked={scopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                  />
                }
                label={scope.label}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || name.trim().length === 0 || scopes.length === 0}
          >
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApiKeysTab;
