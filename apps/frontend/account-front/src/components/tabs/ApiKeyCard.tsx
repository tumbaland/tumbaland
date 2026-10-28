import React from 'react';
import { Box, Button, Chip, CircularProgress, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { Block, ContentCopy, DeleteForever, Visibility, VisibilityOff } from '@mui/icons-material';
import type { ApiKey } from '../../services/apiKeyService';

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const isRevoked = (key: ApiKey): boolean => Boolean(key.revokedAt);

const isExpired = (key: ApiKey): boolean => Boolean(key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now());

interface ApiKeyCardProps {
  apiKey: ApiKey;
  /** The full token, once revealed this session. */
  token: string | undefined;
  revealing: boolean;
  tenantName: (id: string) => string;
  onToggleReveal: (key: ApiKey) => void;
  onCopy: (key: ApiKey) => void;
  onRevoke: (key: ApiKey) => void;
  onDelete: (key: ApiKey) => void;
}

/** One key: its name and reach, the masked or revealed token, its scopes and its history. */
export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  apiKey: key,
  token,
  revealing,
  tenantName,
  onToggleReveal,
  onCopy,
  onRevoke,
  onDelete
}) => {
  const dead = isRevoked(key) || isExpired(key);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, opacity: dead ? 0.6 : 1 }}>
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
              onClick={() => onToggleReveal(key)}
              disabled={revealing}
            >
              {revealing ? (
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
            <IconButton size="small" aria-label={`Copy ${key.name}`} onClick={() => onCopy(key)} disabled={!token}>
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
          <Button size="small" color="warning" startIcon={<Block />} onClick={() => onRevoke(key)}>
            Revoke
          </Button>
        )}
        <Button size="small" color="error" startIcon={<DeleteForever />} onClick={() => onDelete(key)}>
          Delete
        </Button>
      </Box>
    </Paper>
  );
};
