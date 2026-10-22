import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import { brand, ink } from '@tumbaland/frontend-core';
import type { PhotoAlbum } from '../../types';

export interface AlbumDestinationProps {
  photoAlbum: PhotoAlbum;
  /** "Not this one", for the send being composed: none of its photos go. */
  skip: boolean;
  /** How many of the tray's photos go, of how many, when some were left out one by one. */
  going?: number;
  total?: number;
  onToggleSkip: () => void;
  onChoose: () => void;
  onTurnOff: () => void;
}

/**
 * Where the photos on the tray will go, said at the moment it matters.
 *
 * Always visible while there are photos to send, which is also how someone
 * notices they are still sending to "Rome" a week after getting home.
 */
export function AlbumDestination({
  photoAlbum,
  skip,
  going,
  total,
  onToggleSkip,
  onChoose,
  onTurnOff
}: AlbumDestinationProps) {
  if (photoAlbum.mode === 'unset') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2, pt: 1 }}>
        <PhotoAlbumOutlinedIcon sx={{ fontSize: 18, color: brand.pinkInk }} />
        <Typography variant="body2" sx={{ flex: 1, minWidth: 160, color: ink.body }}>
          Where should chat photos go?
        </Typography>
        <Button size="small" variant="contained" onClick={onChoose}>
          Choose album
        </Button>
        <Button size="small" onClick={onTurnOff} sx={{ color: ink.muted }}>
          Don&apos;t save
        </Button>
      </Box>
    );
  }

  const albumName = photoAlbum.albumName ?? 'album';
  const some = going !== undefined && total !== undefined && going > 0 && going < total;
  const label =
    photoAlbum.mode !== 'album'
      ? 'Not saving to Album'
      : some
        ? `Adding ${going} of ${total} to ${albumName}`
        : `Adding to ${albumName}`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1 }}>
      <Button
        size="small"
        onClick={onChoose}
        startIcon={<PhotoAlbumOutlinedIcon />}
        aria-label={`${label}. Change album`}
        sx={{
          color: photoAlbum.mode === 'album' && !skip ? brand.pinkInk : ink.muted,
          textTransform: 'none',
          textDecoration: skip ? 'line-through' : 'none',
          minWidth: 0,
          maxWidth: '65%',
          '& .MuiButton-startIcon': { mr: 0.5 }
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </Box>
      </Button>
      {photoAlbum.mode === 'album' && (
        <Chip
          size="small"
          label="Not this one"
          variant={skip ? 'filled' : 'outlined'}
          color={skip ? 'default' : undefined}
          onClick={onToggleSkip}
          aria-pressed={skip}
        />
      )}
    </Box>
  );
}
