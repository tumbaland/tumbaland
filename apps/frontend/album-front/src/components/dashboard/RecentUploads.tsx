import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { AddPhotoAlternate as AddPhotoIcon } from '@mui/icons-material';
import { useRecentPhotos } from '../../hooks/useHighlights';
import { HighlightPhoto } from '../../types';
import { appPath } from '../../appBase';
import { PhotoTileGrid, TILES_BY_WIDTH } from '../PhotoTileGrid';

const formatWhen = (photo: HighlightPhoto): string => {
  const when = new Date(photo.takenAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return photo.dateSource === 'uploaded' ? `${when} (uploaded)` : when;
};

const describe = (photo: HighlightPhoto): string =>
  `${photo.title || photo.originalName}. ${formatWhen(photo)} · ${photo.albumName}`;

interface RecentUploadsProps {
  groupId?: string;
}

/**
 * The newest photos in the library, whatever album they landed in.
 *
 * Ordered by when they arrived rather than when they were taken, so a holiday
 * imported this afternoon sits at the top however old the pictures are — this
 * row answers "what have we just added".
 *
 * Silent while loading, on failure and when empty, like the other two strips:
 * a dashboard must not fail because one card's query did.
 */
const RecentUploads: React.FC<RecentUploadsProps> = ({ groupId }) => {
  const navigate = useNavigate();
  const { photos, error } = useRecentPhotos(groupId, TILES_BY_WIDTH.md);

  if (error || photos.length === 0) {
    return null;
  }

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: { xs: 1.25, sm: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <AddPhotoIcon color="primary" sx={{ fontSize: { xs: 20, sm: 24 } }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Just added
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => navigate(appPath('/albums'))} sx={{ flexShrink: 0 }}>
          All albums
        </Button>
      </Stack>

      <PhotoTileGrid
        photos={photos}
        describe={describe}
        onSelect={(photo) => navigate(appPath(`/albums/${photo.albumId}/photos/${photo._id}`))}
      />
    </Card>
  );
};

export default RecentUploads;
