import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  Paper,
  Snackbar,
  Typography
} from '@mui/material';
import { ink } from '@tumbaland/frontend-core';
import { appPath } from '../appBase';
import { Empty, LoadState, PageHeader, Panel } from '../components/ui';
import { ago, formatBytes, formatCount, formatDateTime } from '../format';
import { describeError, useLoad } from '../hooks/useLoad';
import { adminApi } from '../services/adminApi';
import type { DeletionEntry } from '../types';

const plural = (count: number, one: string, many: string): string => `${formatCount(count)} ${count === 1 ? one : many}`;

function Owns({ entry }: { entry: DeletionEntry }) {
  const { albums, photos, activities, storageBytes } = entry.owns;
  return (
    <Typography sx={{ fontSize: 13.5, color: ink.body }}>
      Holds {plural(albums, 'album', 'albums')} with {plural(photos, 'photo', 'photos')},{' '}
      {plural(activities, 'journal entry', 'journal entries')} and {formatBytes(storageBytes)} of files.
    </Typography>
  );
}

function Groups({ entry }: { entry: DeletionEntry }) {
  if (entry.groups.length === 0) return <Typography sx={{ fontSize: 13.5, color: ink.body }}>In no groups.</Typography>;
  return (
    <Typography sx={{ fontSize: 13.5, color: ink.body }}>
      In{' '}
      {entry.groups
        .map(
          (group) =>
            `${group.name} (${group.role}${group.otherMembers.length > 0 ? `, with ${group.otherMembers.join(', ')}` : ', alone'})`
        )
        .join('; ')}
      .
    </Typography>
  );
}

function Who({ entry }: { entry: DeletionEntry }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Link component={RouterLink} to={appPath(`/users/${entry.id}`)} underline="hover" sx={{ fontWeight: 700, color: ink.strong }}>
        {entry.name ?? entry.email}
      </Link>
      {entry.name && <Typography sx={{ fontSize: 13, color: ink.muted }}>{entry.email}</Typography>}
    </Box>
  );
}

/**
 * People who asked for their account to be deleted, and the ones an
 * administrator has closed.
 *
 * Closing signs a person out everywhere and keeps them out, and cuts off their
 * keys and connected apps. It deletes nothing: their data stays where it is
 * until it is removed by hand, and the second list is the backlog for that.
 */
export default function DeletionsPage() {
  const state = useLoad(() => adminApi.deletions(), []);
  const [closing, setClosing] = useState<DeletionEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  const close = async (entry: DeletionEntry) => {
    setBusy(true);
    try {
      const result = await adminApi.confirmDeletion(entry.id);
      setNotice({
        severity: 'success',
        text: `Closed ${result.email}. ${plural(result.sessionsEnded, 'device', 'devices')} signed out, ${plural(result.connectionsRevoked, 'app', 'apps')} and ${plural(result.keysRevoked, 'key', 'keys')} cut off.`
      });
      setClosing(null);
      state.reload();
    } catch (error) {
      setNotice({ severity: 'error', text: describeError(error) });
      setClosing(null);
      state.reload();
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (entry: DeletionEntry) => {
    setBusy(true);
    try {
      await adminApi.reopenAccount(entry.id);
      setNotice({ severity: 'success', text: `Reopened ${entry.email}. They can sign in again.` });
      state.reload();
    } catch (error) {
      setNotice({ severity: 'error', text: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Deletions"
        description="Closing an account signs the person out for good and stops their keys and apps. Nothing is deleted; their data is removed by hand."
      />

      {/* Down the page, where Close and Reopen are, a notice at the top would go unseen. */}
      <Snackbar
        open={notice !== null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // A success can go by itself; a failure stays until it has been read.
        autoHideDuration={notice?.severity === 'success' ? 8000 : null}
        onClose={(_event, reason) => reason !== 'clickaway' && setNotice(null)}
      >
        {notice ? (
          <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)} sx={{ maxWidth: 560 }}>
            {notice.text}
          </Alert>
        ) : undefined}
      </Snackbar>

      <LoadState state={state}>
        {(deletions) => (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Panel title="Asked to be deleted" description="Oldest first. Their accounts work as before until you close them.">
              {deletions.requested.length === 0 ? (
                <Empty>Nobody is waiting.</Empty>
              ) : (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {deletions.requested.map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 2.5, display: 'grid', gap: 0.75 }}>
                      <Who entry={entry} />
                      <Typography sx={{ fontSize: 13.5, color: ink.body }}>
                        Asked {ago(entry.requestedAt).toLowerCase()} ({formatDateTime(entry.requestedAt)}). Last here{' '}
                        {ago(entry.lastVisitAt).toLowerCase()}.
                      </Typography>
                      {entry.visitedSinceRequest && (
                        <Box>
                          <Chip
                            size="small"
                            color="warning"
                            label="Opened the app after asking. Worth a message first, in case it was a slip."
                          />
                        </Box>
                      )}
                      <Groups entry={entry} />
                      <Owns entry={entry} />
                      <Box sx={{ mt: 0.5 }}>
                        <Button color="error" variant="outlined" disabled={busy} onClick={() => setClosing(entry)}>
                          Close account…
                        </Button>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Panel>

            <Panel
              title="Closed, data still here"
              description="The list to work through when removing data by hand."
            >
              {deletions.closed.length === 0 ? (
                <Empty>No closed accounts.</Empty>
              ) : (
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {deletions.closed.map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 2.5, display: 'grid', gap: 0.75 }}>
                      <Who entry={entry} />
                      <Typography sx={{ fontSize: 13.5, color: ink.body }}>
                        Asked {formatDateTime(entry.requestedAt)}. Closed {formatDateTime(entry.confirmedAt)}
                        {entry.confirmedBy ? ` by ${entry.confirmedBy}` : ''}.
                      </Typography>
                      <Groups entry={entry} />
                      <Owns entry={entry} />
                      <Box sx={{ mt: 0.5 }}>
                        <Button variant="outlined" disabled={busy} onClick={() => void reopen(entry)}>
                          Reopen
                        </Button>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Panel>
          </Box>
        )}
      </LoadState>

      <Dialog open={closing !== null} onClose={() => !busy && setClosing(null)} aria-labelledby="close-account-title">
        {closing && (
          <>
            <DialogTitle id="close-account-title">Close {closing.email}?</DialogTitle>
            <DialogContent>
              <DialogContentText component="div">
                <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75 }}>
                  <li>They are signed out on every device and cannot sign in again.</li>
                  <li>
                    Their keys stop working, and their connected assistants can renew nothing. An assistant that already holds
                    an access token can keep going for up to an hour.
                  </li>
                  <li>Nothing is deleted. Their photos, entries and files stay until you remove them by hand.</li>
                  {closing.groups.some((group) => group.otherMembers.length > 0) && (
                    <li>The groups they share keep going for the people left in them.</li>
                  )}
                  <li>You can reopen it from this page if it was a mistake.</li>
                </Box>
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setClosing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button color="error" variant="contained" disabled={busy} onClick={() => void close(closing)}>
                Close account
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
