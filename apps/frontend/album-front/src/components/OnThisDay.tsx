import React from 'react';
import { useNavigate } from 'react-router';
import { Card, Chip, Stack, Typography } from '@mui/material';
import { HistoryToggleOff as HistoryIcon } from '@mui/icons-material';
import { formatDay } from '@tumbaland/frontend-core';
import { useMemories } from '../hooks/useMemories';
import { MemoryPhoto } from '../types';
import { appPath } from '../appBase';
import { PhotoTileGrid } from './PhotoTileGrid';

interface OnThisDayProps {
  groupId?: string;
}

const formatFullDay = (day: string): string => formatDay(day, { year: 'numeric', month: 'long', day: 'numeric' });

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

      <PhotoTileGrid
        photos={year.photos}
        describe={describe}
        maxWidth={{ xs: '100%', sm: 660 }}
        onSelect={(photo) => navigate(appPath(`/albums/${photo.albumId}/photos/${photo._id}`))}
      />
    </Card>
  );
};

export default OnThisDay;
