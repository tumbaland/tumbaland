import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import { ink } from '@tumbaland/frontend-core';
import type { AlbumOption, PhotoAlbum, PhotoAlbumChoice } from '../../types';

export interface AlbumPickerProps {
  open: boolean;
  onClose: () => void;
  current: PhotoAlbum;
  /**
   * `conversation` sets where new photos go; `photo` moves ones already sent,
   * where "off" means taking them out of their album.
   */
  purpose?: 'conversation' | 'photo';
  loadAlbums: () => Promise<AlbumOption[]>;
  onChoose: (choice: PhotoAlbumChoice) => Promise<void>;
}

export const WORDING = {
  conversation: {
    title: 'Where should chat photos go?',
    hint: 'Photos and videos you both send are added to this album until someone changes it.',
    off: "Don't save to Album"
  },
  photo: {
    title: 'Move to album',
    hint: 'Only this changes. New photos still go where the chat sends them.',
    off: 'Not in an album'
  }
} as const;

export interface AlbumChoicesProps {
  /** Loads the albums while true, fresh each time it turns true. */
  active: boolean;
  current: PhotoAlbum;
  /** The label of the "nowhere" row. */
  offLabel: string;
  loadAlbums: () => Promise<AlbumOption[]>;
  onChoose: (choice: PhotoAlbumChoice) => Promise<void>;
  /** After a choice is saved, or when the one already chosen is picked again. */
  onDone: () => void;
  /** While a choice is saving, so the dialog around it can hold off closing. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * The list itself: a new album, the group's albums, and nowhere. Shared by
 * the picker below and the chat's "Album and collage" dialog.
 */
export function AlbumChoices({ active, current, offLabel, loadAlbums, onChoose, onDone, onBusyChange }: AlbumChoicesProps) {
  const [albums, setAlbums] = useState<AlbumOption[] | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  // A saved choice can take this list off screen in the same update that
  // clears `busy`, so the effect above never sees it clear. Said again on the
  // way out, or the dialog around it would stay locked.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    setAlbums(null);
    setNaming(false);
    setName('');
    setError(null);
    loadAlbums()
      .then((list) => live && setAlbums(list))
      .catch(() => live && setError('Could not load your albums. Try again.'));
    return () => {
      live = false;
    };
  }, [active, loadAlbums]);

  const choose = async (choice: PhotoAlbumChoice) => {
    // Picking what is already chosen changes nothing, so it says nothing either.
    const unchanged =
      (choice.mode === 'off' && current.mode === 'off') ||
      (choice.mode === 'album' && 'albumId' in choice && current.mode === 'album' && current.albumId === choice.albumId);
    if (unchanged) {
      onDone();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onChoose(choice);
      onDone();
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) void choose({ mode: 'album', newAlbumName: name.trim() });
  };

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mx: 1, mb: 1 }}>
          {error}
        </Alert>
      )}

      {!albums && !error ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <List dense disablePadding aria-label="Albums">
          {/* First, so taking a photo out of its album does not mean scrolling
              past every album the group has. */}
          <ListItemButton
            selected={current.mode === 'off'}
            disabled={busy}
            onClick={() => void choose({ mode: 'off' })}
            sx={{ borderRadius: 2 }}
          >
            <ListItemIcon>
              <DoNotDisturbAltIcon />
            </ListItemIcon>
            <ListItemText primary={offLabel} />
            {current.mode === 'off' && <CheckIcon fontSize="small" aria-label="Current" />}
          </ListItemButton>

          <Divider sx={{ my: 1 }} />

          {naming ? (
            <Box component="form" onSubmit={create} sx={{ display: 'flex', gap: 1, px: 1, py: 1 }}>
              <TextField
                autoFocus
                size="small"
                fullWidth
                label="Album name"
                placeholder="Rome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
              <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
                Create
              </Button>
            </Box>
          ) : (
            <ListItemButton onClick={() => setNaming(true)} disabled={busy} sx={{ borderRadius: 2 }}>
              <ListItemIcon>
                <AddIcon />
              </ListItemIcon>
              <ListItemText primary="New album…" />
            </ListItemButton>
          )}

          {(albums ?? []).map((album) => {
            const selected = current.mode === 'album' && current.albumId === album.id;
            return (
              <ListItemButton
                key={album.id}
                selected={selected}
                disabled={busy}
                onClick={() => void choose({ mode: 'album', albumId: album.id })}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon>
                  <PhotoAlbumOutlinedIcon />
                </ListItemIcon>
                <ListItemText
                  primary={album.name}
                  secondary={`${album.photoCount} ${album.photoCount === 1 ? 'item' : 'items'}`}
                />
                {selected && <CheckIcon fontSize="small" aria-label="Current" />}
              </ListItemButton>
            );
          })}

        </List>
      )}
    </>
  );
}

/**
 * "Photos go to": one of the group's albums, a new one, or nowhere.
 *
 * Also moves a photo already sent (`purpose="photo"`), where "nowhere" means
 * taking it out of its album.
 *
 * The choice is the conversation's, not the person's, so it is worded as
 * where *chat* photos go. It stays until someone changes it: a trip is picking
 * "Rome" on the way out and something else on the way back.
 */
export function AlbumPicker({ open, onClose, current, purpose = 'conversation', loadAlbums, onChoose }: AlbumPickerProps) {
  const wording = WORDING[purpose];
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>{wording.title}</DialogTitle>
      <DialogContent sx={{ px: 1 }}>
        <Box sx={{ px: 2, pb: 1, color: ink.muted, fontSize: 14 }}>
          {wording.hint}
        </Box>
        <AlbumChoices
          active={open}
          current={current}
          offLabel={wording.off}
          loadAlbums={loadAlbums}
          onChoose={onChoose}
          onDone={onClose}
          onBusyChange={setBusy}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
