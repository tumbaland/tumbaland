import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Card, Chip, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { HistoryToggleOff as HistoryIcon, Image as ImageIcon } from '@mui/icons-material';
import { useMemories } from '../hooks/useMemories';
import { MemoryPhoto, MemoryYear } from '../types';

interface OnThisDayProps {
  groupId?: string;
}

/**
 * Tiles in the row, the count tile included.
 *
 * Every returned photo used to sit in a row that scrolled sideways. A busy day
 * became a wall of thumbnails, and the row's full width leaked into the page
 * layout on a phone, pushing the whole albums page past the screen edge. Four
 * fit a phone at a comfortable size; anything past that is a count.
 */
const MAX_TILES = 4;

const formatFullDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

const yearsAgoLabel = (yearsAgo: number): string =>
  yearsAgo === 1 ? 'a year ago' : `${yearsAgo} years ago`;

/**
 * What the tooltip says about a photo. A photo remembered on its upload date
 * rather than a capture date says so. The strip should never imply it knows
 * when a picture was taken when all it really has is when it arrived.
 */
const describe = (photo: MemoryPhoto): string => {
  const where = photo.title || photo.originalName;
  const when = formatFullDay(photo.memoryDate);
  const source = photo.dateSource === 'uploaded' ? ' (uploaded)' : '';
  return `${where}. ${when}${source} · ${photo.albumName}`;
};

const tileSx = {
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
} as const;

interface MemoryTilesProps {
  year: MemoryYear;
  onSelect: (photo: MemoryPhoto) => void;
}

const MemoryTiles: React.FC<MemoryTilesProps> = ({ year, onSelect }) => {
  const theme = useTheme();
  // photoCount is the truth about the day even when the server capped the list,
  // so it decides whether a count tile is needed, not photos.length.
  const needsCount = year.photoCount > Math.min(year.photos.length, MAX_TILES);
  const shown = year.photos.slice(0, needsCount ? MAX_TILES - 1 : MAX_TILES);
  const hidden = year.photoCount - shown.length;

  return (
    // Fixed columns sized from the card, never from the photos: the row can
    // only ever be as wide as the space it is given.
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${MAX_TILES}, minmax(0, 1fr))`,
        gap: 1,
        maxWidth: { xs: '100%', sm: 440 }
      }}
    >
      {shown.map((photo) => {
        const src = photo.thumbnailSignedUrl || photo.signedUrl;

        return (
          <Tooltip key={photo._id} title={describe(photo)}>
            <Box
              component="button"
              type="button"
              onClick={() => onSelect(photo)}
              aria-label={describe(photo)}
              sx={{
                ...tileSx,
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

      {needsCount && (
        <Box
          role="img"
          aria-label={`${hidden} more ${hidden === 1 ? 'photo' : 'photos'}`}
          sx={{ ...tileSx, border: '1px dashed', borderColor: 'divider' }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            +{hidden}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * Photos from this day in the most recent earlier year that has any.
 *
 * One heading line and one row of photos. Every past year used to get its own
 * row, which on a phone pushed the albums below the fold; the nearest year is
 * the memory people look for, and it keeps the card the same size however long
 * the library goes back.
 *
 * Renders nothing at all when there is no history for today — an empty
 * "On this day" heading is worse than no heading, and most days in a young
 * library have nothing to show.
 */
const OnThisDay: React.FC<OnThisDayProps> = ({ groupId }) => {
  const navigate = useNavigate();
  const { memories, error } = useMemories(groupId);

  // Silent on both failure and emptiness: this is a bonus row above the albums,
  // never the reason someone came to the page.
  if (error || !memories || memories.years.length === 0) {
    return null;
  }

  // The API lists years most recent first.
  const year = memories.years[0];

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 1.25, sm: 2 },
        mb: { xs: 2, sm: 3 }
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <HistoryIcon color="primary" sx={{ fontSize: { xs: 20, sm: 24 } }} />
        <Typography
          variant="h6"
          component="h2"
          sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}
        >
          On this day
        </Typography>
        <Chip size="small" label={yearsAgoLabel(year.yearsAgo)} sx={{ fontWeight: 600 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {year.year} · {year.photoCount} {year.photoCount === 1 ? 'photo' : 'photos'}
        </Typography>
      </Stack>

      <MemoryTiles
        year={year}
        onSelect={(photo) => navigate(`/albums/${photo.albumId}/photos/${photo._id}`)}
      />
    </Card>
  );
};

export default OnThisDay;
