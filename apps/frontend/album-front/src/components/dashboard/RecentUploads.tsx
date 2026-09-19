import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Button, Card, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { AddPhotoAlternate as AddPhotoIcon, Image as ImageIcon } from '@mui/icons-material';
import { useRecentPhotos } from '../../hooks/useHighlights';
import { HighlightPhoto } from '../../types';

/** Same ladder as the memories strip, so the two rows line up column for column. */
const TILES_BY_WIDTH = { xs: 4, sm: 6, md: 8 } as const;

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
  const theme = useTheme();
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
        <Button size="small" onClick={() => navigate('/albums')} sx={{ flexShrink: 0 }}>
          All albums
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: `repeat(${TILES_BY_WIDTH.xs}, minmax(0, 1fr))`,
            sm: `repeat(${TILES_BY_WIDTH.sm}, minmax(0, 1fr))`,
            md: `repeat(${TILES_BY_WIDTH.md}, minmax(0, 1fr))`
          },
          gap: 1
        }}
      >
        {photos.map((photo, index) => {
          const src = photo.thumbnailSignedUrl || photo.signedUrl;

          return (
            <Tooltip key={photo._id} title={describe(photo)}>
              <Box
                component="button"
                type="button"
                onClick={() => navigate(`/albums/${photo.albumId}/photos/${photo._id}`)}
                aria-label={describe(photo)}
                sx={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  // Past the column count for this width, so hidden rather than
                  // dropped: widening the window brings it in.
                  display: {
                    xs: index < TILES_BY_WIDTH.xs ? 'flex' : 'none',
                    sm: index < TILES_BY_WIDTH.sm ? 'flex' : 'none',
                    md: 'flex'
                  },
                  p: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'action.hover',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.15)}`
                  }
                }}
              >
                {src ? (
                  <Box
                    component="img"
                    src={src}
                    alt={photo.title || photo.originalName}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <ImageIcon sx={{ color: 'text.disabled' }} />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Card>
  );
};

export default RecentUploads;
