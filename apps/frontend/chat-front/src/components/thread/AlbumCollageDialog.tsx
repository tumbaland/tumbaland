import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import { ink, surface } from '@tumbaland/frontend-core';
import { AlbumChoices, WORDING } from './AlbumPicker';
import { newClientId } from '../../services/chatApi';
import type { AlbumOption, PhotoAlbum, PhotoAlbumChoice } from '../../types';

export interface AlbumCollageDialogProps {
  open: boolean;
  onClose: () => void;
  /** Where this chat's photos go. A collage is made on that album. */
  photoAlbum: PhotoAlbum;
  loadAlbums: () => Promise<AlbumOption[]>;
  onChooseAlbum: (choice: PhotoAlbumChoice) => Promise<void>;
  onStartCollage: (title: string, clientId: string) => Promise<void>;
}

const monthTitle = () => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="h3"
      sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.muted, mb: 1 }}
    >
      {children}
    </Typography>
  );
}

/**
 * The chat's album and its collages in one place.
 *
 * They were two menu items, and the collage one could only say "choose an
 * album first" and send the person off to the other. A collage is made on the
 * album the chat's photos go to, so the two belong together: pick the album
 * at the top, and the collage below is ready to make from it. Making one
 * posts its card in the chat, where everyone joins it.
 *
 * Choosing an album opens the list in place and comes back here, rather than
 * closing, so making a collage straight after is one more tap.
 */
export function AlbumCollageDialog({
  open,
  onClose,
  photoAlbum,
  loadAlbums,
  onChooseAlbum,
  onStartCollage
}: AlbumCollageDialogProps) {
  const [view, setView] = useState<'main' | 'albums'>('main');
  const [title, setTitle] = useState('');
  const [titleTyped, setTitleTyped] = useState(false);
  const [clientId, setClientId] = useState('');
  const [starting, setStarting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAlbum = photoAlbum.mode === 'album';
  const busy = starting || choosing;

  // Fresh each time it opens. The key stays for retries within one opening.
  useEffect(() => {
    if (!open) return;
    setView('main');
    setTitleTyped(false);
    setClientId(newClientId());
    setError(null);
  }, [open]);

  // Named after the album until the person types a name of their own, so
  // choosing an album here also renames the collage to match.
  useEffect(() => {
    if (open && !titleTyped) setTitle(photoAlbum.albumName || monthTitle());
  }, [open, titleTyped, photoAlbum.albumName]);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setStarting(true);
    setError(null);
    try {
      await onStartCollage(title.trim(), clientId);
      onClose();
    } catch (cause) {
      // A 400 is worded for people ("Choose an album…"); anything else is not.
      const status = (cause as { status?: number }).status;
      setError(status === 400 && cause instanceof Error ? cause.message : 'Could not make the collage. Try again.');
    } finally {
      setStarting(false);
    }
  };

  const albumLabel =
    photoAlbum.mode === 'album'
      ? (photoAlbum.albumName ?? 'An album')
      : photoAlbum.mode === 'off'
        ? 'Not saving to Album'
        : 'Not chosen yet';
  const albumHint =
    photoAlbum.mode === 'album'
      ? 'Photos and videos you both send are added here.'
      : 'Choose an album to keep the photos you both send.';

  if (view === 'albums') {
    return (
      <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton aria-label="Back" onClick={() => setView('main')} disabled={busy} edge="start">
            <ArrowBackIcon />
          </IconButton>
          {WORDING.conversation.title}
        </DialogTitle>
        <DialogContent sx={{ px: 1 }}>
          <Box sx={{ px: 2, pb: 1, color: ink.muted, fontSize: 14 }}>{WORDING.conversation.hint}</Box>
          <AlbumChoices
            active={open}
            current={photoAlbum}
            offLabel={WORDING.conversation.off}
            loadAlbums={loadAlbums}
            onChoose={onChooseAlbum}
            onDone={() => setView('main')}
            onBusyChange={setChoosing}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Album and collage</DialogTitle>
      <DialogContent>
        <Box component="section" aria-label="Photos go to">
          <SectionHeading>Photos go to</SectionHeading>
          <ListItemButton
            onClick={() => setView('albums')}
            disabled={busy}
            sx={{ borderRadius: 2, bgcolor: surface.sunken, '&:hover': { bgcolor: surface.sunken } }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <PhotoAlbumOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary={albumLabel} secondary={albumHint} />
            <ChevronRightIcon sx={{ color: ink.muted }} aria-label="Change" />
          </ListItemButton>
        </Box>

        <Divider sx={{ my: 2.5 }} />

        {/* Kept to a name and one button. The button says it is an
            invitation, which is the one thing that was not obvious: it posts
            a card in this chat, and both of you add photos from there. */}
        <Box component="section" aria-label="Collage">
          <SectionHeading>Collage</SectionHeading>
          {hasAlbum ? (
            <Box component="form" onSubmit={start} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                fullWidth
                size="small"
                label="Collage name"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleTyped(true);
                }}
                helperText={`From the photos in ${photoAlbum.albumName ?? 'this chat’s album'}`}
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                startIcon={<PersonAddAltOutlinedIcon />}
                disabled={busy || !title.trim()}
              >
                Invite to make a collage
              </Button>
            </Box>
          ) : (
            <Typography sx={{ color: ink.muted, fontSize: 14 }}>Choose an album above first.</Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
