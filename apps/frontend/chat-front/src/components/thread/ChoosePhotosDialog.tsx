import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { brand, ink, surface } from '@tumbaland/frontend-core';
import type { Attachment } from '../../types';

export interface ChoosePhotosDialogProps {
  open: boolean;
  title: string;
  /** The message's photos and videos to choose from. */
  photos: Attachment[];
  /** Ticked when it opens, by file id. */
  initial: string[];
  /** The button's words for how many are ticked: "Next", "Take 2 out". */
  confirmLabel: (count: number) => string;
  /** Rejects to keep the dialog open with an error. */
  onConfirm: (fileIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

/**
 * Which of a message's photos a change is for, when it has more than one.
 * Each shows the album it is in now, so a mixed message reads as it is.
 */
export function ChoosePhotosDialog({
  open,
  title,
  photos,
  initial,
  confirmLabel,
  onConfirm,
  onClose
}: ChoosePhotosDialogProps) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh each time it opens, for whichever message it opens on.
  const initialKey = initial.join('|');
  useEffect(() => {
    if (!open) return;
    setChosen(new Set(initialKey ? initialKey.split('|') : []));
    setError(null);
  }, [open, initialKey]);

  const toggle = (fileId: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      // In the message's order, whatever order they were ticked in.
      await onConfirm(photos.filter((photo) => chosen.has(photo.fileId)).map((photo) => photo.fileId));
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const allChosen = photos.every((photo) => chosen.has(photo.fileId));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button
            size="small"
            onClick={() => setChosen(allChosen ? new Set() : new Set(photos.map((photo) => photo.fileId)))}
          >
            {allChosen ? 'Select none' : 'Select all'}
          </Button>
        </Box>
        <Box role="group" aria-label="Photos" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {photos.map((photo, index) => {
            const on = chosen.has(photo.fileId);
            const src = photo.thumbnailUrl ?? photo.posterUrl ?? photo.url ?? undefined;
            return (
              <Box key={photo.fileId}>
                <Box
                  component="button"
                  type="button"
                  aria-pressed={on}
                  aria-label={`Photo ${index + 1}${photo.albumName ? `, in ${photo.albumName}` : ', not in an album'}`}
                  onClick={() => toggle(photo.fileId)}
                  sx={{
                    position: 'relative',
                    display: 'block',
                    width: '100%',
                    aspectRatio: '1',
                    p: 0,
                    border: 'none',
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: surface.sunken,
                    outline: on ? `3px solid ${brand.pinkInk}` : 'none',
                    outlineOffset: -3
                  }}
                >
                  {src && (
                    <Box
                      component="img"
                      src={src}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 1 : 0.55 }}
                    />
                  )}
                  <Box
                    sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', color: on ? brand.pinkInk : '#fff' }}
                  >
                    {on ? (
                      <CheckCircleIcon sx={{ fontSize: 22, bgcolor: '#fff', borderRadius: '50%' }} />
                    ) : (
                      <RadioButtonUncheckedIcon sx={{ fontSize: 22, filter: 'drop-shadow(0 0 2px rgba(0,0,0,.6))' }} />
                    )}
                  </Box>
                </Box>
                <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.25, color: ink.muted }}>
                  {photo.albumName ? `In ${photo.albumName}` : 'Not in an album'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void confirm()} disabled={busy || chosen.size === 0}>
          {confirmLabel(chosen.size)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
