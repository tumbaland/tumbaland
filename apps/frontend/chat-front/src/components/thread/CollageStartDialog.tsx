import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { newClientId } from '../../services/chatApi';
import type { PhotoAlbum } from '../../types';

export interface CollageStartDialogProps {
  open: boolean;
  onClose: () => void;
  /** Where this chat's photos go: the collage's photo tray is that album. */
  photoAlbum: PhotoAlbum;
  /** Opens the "Photos go to" picker, for a chat that has no album yet. */
  onChooseAlbum: () => void;
  onStart: (title: string, clientId: string) => Promise<void>;
}

const monthTitle = () => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/**
 * "Make a collage together": names the collage and makes it on the album this
 * chat's photos go to, so what is sent here shows up in its photo tray.
 */
export function CollageStartDialog({ open, onClose, photoAlbum, onChooseAlbum, onStart }: CollageStartDialogProps) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAlbum = photoAlbum.mode === 'album';

  // A fresh name and key each time it opens; the key stays for retries within.
  useEffect(() => {
    if (!open) return;
    setTitle(photoAlbum.albumName || monthTitle());
    setClientId(newClientId());
    setError(null);
    // Only on opening: the album being chosen meanwhile should not wipe a name typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(title.trim(), clientId);
      onClose();
    } catch (cause) {
      // A 400 is worded for people ("Choose an album…"); anything else is not.
      const status = (cause as { status?: number }).status;
      setError(status === 400 && cause instanceof Error ? cause.message : 'Could not make the collage. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={start}>
        <DialogTitle>Make a collage together</DialogTitle>
        <DialogContent>
          {hasAlbum ? (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Uses the photos in {photoAlbum.albumName ?? 'this chat’s album'}, including ones you send here
                later. Everyone in the chat gets a card to join.
              </DialogContentText>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                autoFocus
                fullWidth
                label="Collage name"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
            </>
          ) : (
            <DialogContentText>
              A collage uses the album this chat’s photos go to. Choose one first, then make the collage.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {hasAlbum ? (
            <Button type="submit" variant="contained" disabled={busy || !title.trim()}>
              Make collage
            </Button>
          ) : (
            <Button variant="contained" onClick={onChooseAlbum}>
              Choose album
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
}
