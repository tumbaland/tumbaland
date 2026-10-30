import { useState } from 'react';
import { Alert, Box, Button, Chip, TextField, Typography } from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { Panel } from '../ui';
import { formatDate } from '../../format';
import { describeError } from '../../hooks/useLoad';
import { adminApi } from '../../services/adminApi';
import type { ClaudeKey } from '../../types';

/**
 * The Anthropic key the chat assistants run on.
 *
 * Write-only: it goes in once and is never shown again, only its last four
 * characters. Anthropic is asked about it when it is saved, so a mistyped or
 * revoked key is refused here and not on someone's first mention. The expiry
 * date is a reminder to replace it; what actually stops assistants is Anthropic
 * refusing the key, and that shows here too.
 */
export function KeyPanel({ data, onChanged }: { data: ClaudeKey; onChanged: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [expiresOn, setExpiresOn] = useState(data.expiresOn ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const changed = apiKey.trim() !== '' || (data.configured && expiresOn !== (data.expiresOn ?? ''));

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setApiKey('');
      setConfirmRemove(false);
      onChanged();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(() =>
      adminApi.saveClaudeKey({
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        expiresOn: expiresOn || null
      })
    );

  const expiry =
    data.daysLeft === null
      ? 'No expiry date set'
      : data.daysLeft < 0
        ? `Expired ${-data.daysLeft} day${data.daysLeft === -1 ? '' : 's'} ago`
        : data.daysLeft === 0
          ? 'Expires today'
          : `Expires in ${data.daysLeft} day${data.daysLeft === 1 ? '' : 's'}`;

  return (
    <Panel
      title="API key"
      description="What the chat assistants run on. Everyone's replies are billed to the account it belongs to."
      action={
        data.configured ? (
          <Chip
            label={data.status === 'rejected' ? 'Rejected by Anthropic' : 'Working'}
            color={data.status === 'rejected' ? 'error' : 'success'}
            size="small"
          />
        ) : (
          <Chip label="Not set" size="small" />
        )
      }
    >
      {!data.encryptionReady && (
        <Alert severity="error" sx={{ mb: 2 }}>
          chat-service has no API_KEY_ENCRYPTION_SECRET, so it cannot keep a key. Set it, restart chat-service, and come back.
        </Alert>
      )}
      {data.status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Anthropic is not accepting this key{data.rejectedReason ? ` (${data.rejectedReason})` : ''}. Assistants are off for everyone
          until it does. Check again, or save a new one.
        </Alert>
      )}
      {data.expiringSoon && data.status !== 'rejected' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {expiry}. Make a new key in the Anthropic console and save it here before then.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {data.configured && (
        <Typography sx={{ fontSize: 14, color: ink.body, mb: 2 }}>
          <Box component="span" sx={{ fontFamily: 'monospace' }}>
            sk-ant-…{data.last4}
          </Box>{' '}
          · set by {data.setBy ?? 'someone'} on {formatDate(data.setAt)} · {expiry}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, alignItems: 'start' }}>
        <TextField
          label={data.configured ? 'Replace the key' : 'API key'}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
          disabled={busy || !data.encryptionReady}
          placeholder="sk-ant-…"
          helperText="Checked with Anthropic before it is kept. It is never shown again."
          fullWidth
        />
        <TextField
          label="Expires on"
          type="date"
          value={expiresOn}
          onChange={(event) => setExpiresOn(event.target.value)}
          disabled={busy || !data.encryptionReady}
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="A reminder, from 14 days before."
          fullWidth
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !changed || !data.encryptionReady}>
          Save
        </Button>
        {data.configured && !confirmRemove && (
          // Mostly for a rejected key: one 401 rejects it, and a 401 can be Anthropic having a bad minute.
          <Button onClick={() => void run(() => adminApi.checkClaudeKey())} disabled={busy || !data.encryptionReady}>
            Check again
          </Button>
        )}
        {data.configured && !confirmRemove && (
          <Button color="error" onClick={() => setConfirmRemove(true)} disabled={busy}>
            Remove the key
          </Button>
        )}
        {confirmRemove && (
          <>
            <Typography sx={{ fontSize: 14 }}>Assistants stop answering until a new key is saved.</Typography>
            <Button color="error" variant="contained" onClick={() => void run(() => adminApi.removeClaudeKey())} disabled={busy}>
              Yes, remove it
            </Button>
            <Button onClick={() => setConfirmRemove(false)} disabled={busy}>
              Keep it
            </Button>
          </>
        )}
      </Box>
    </Panel>
  );
}
