import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Card, Chip, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { HistoryToggleOff as HistoryIcon, Image as ImageIcon } from '@mui/icons-material';
import { useMemories } from '../hooks/useMemories';
import { MemoryPhoto, MemoryYear } from '../types';
import { appPath } from '../appBase';
import { MediaThumb } from '@tumbaland/frontend-core';

interface OnThisDayProps {
  groupId?: string;
}

/**
 * How many photos the row shows, by screen width.
 *
 * Every returned photo used to sit in a row that scrolled sideways, which on a
 * phone pushed the whole page past the screen edge. The fix capped the row at
 * four and spent the fourth slot on a `+5` counter — but a counter is a dead
 * tile: it shows nothing, and it cannot be clicked. The extra photos are simply
 * not drawn now, and a wider screen draws more of them, so resizing reveals
 * them rather than trading one away to say they exist.
 */
const TILES_BY_WIDTH = { xs: 4, sm: 6, md: 8 } as const;

const formatFullDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

const yearsAgoLabel = (yearsAgo: number): string => (yearsAgo === 1 ? 'a year ago' : `${yearsAgo} years ago`);

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
  // Every photo the server sent is rendered; CSS decides how many are on
  // screen. Doing it the other way — slicing to a width read in JavaScript —
  // would need a resize listener and would still be a frame behind.
  const shown = year.photos.slice(0, TILES_BY_WIDTH.md);

  return (
    // Fixed columns sized from the card, never from the photos: the row can
    // only ever be as wide as the space it is given. The tiles past the
    // column count are hidden rather than dropped, so widening the window
    // brings them in.
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: `repeat(${TILES_BY_WIDTH.xs}, minmax(0, 1fr))`,
          sm: `repeat(${TILES_BY_WIDTH.sm}, minmax(0, 1fr))`,
          md: `repeat(${TILES_BY_WIDTH.md}, minmax(0, 1fr))`
        },
        gap: 1,
        maxWidth: { xs: '100%', sm: 660 }
      }}
    >
      {shown.map((photo, index) => {
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
                <MediaThumb
                  src={src}
                  mimetype={photo.mimetype}
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
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          On this day
        </Typography>
        <Chip size="small" label={yearsAgoLabel(year.yearsAgo)} sx={{ fontWeight: 600 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {year.year} · {year.photoCount} {year.photoCount === 1 ? 'photo' : 'photos'}
        </Typography>
      </Stack>

      <MemoryTiles year={year} onSelect={(photo) => navigate(appPath(`/albums/${photo.albumId}/photos/${photo._id}`))} />
    </Card>
  );
};

export default OnThisDay;
