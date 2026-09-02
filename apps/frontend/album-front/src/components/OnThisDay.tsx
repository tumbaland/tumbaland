import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Card, Chip, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { HistoryToggleOff as HistoryIcon, Image as ImageIcon } from '@mui/icons-material';
import { useMemories } from '../hooks/useMemories';
import { MemoryPhoto, MemoryYear } from '../types';

interface OnThisDayProps {
  groupId?: string;
  /** thumbnail edge length in px */
  size?: number;
}

const THUMB_SIZE = 104;

const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

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
 * rather than a capture date says so — the strip should never imply it knows
 * when a picture was taken when all it really has is when it arrived.
 */
const describe = (photo: MemoryPhoto): string => {
  const where = photo.title || photo.originalName;
  const when = formatFullDay(photo.memoryDate);
  const source = photo.dateSource === 'uploaded' ? ' (uploaded)' : '';
  return `${where} — ${when}${source} · ${photo.albumName}`;
};

interface MemoryYearRowProps {
  year: MemoryYear;
  size: number;
  onSelect: (photo: MemoryPhoto) => void;
}

const MemoryYearRow: React.FC<MemoryYearRowProps> = ({ year, size, onSelect }) => {
  const theme = useTheme();
  // The cap is applied server-side, so the count is the truth about the day
  // even when only a handful of photos came back.
  const hidden = year.photoCount - year.photos.length;

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip size="small" label={yearsAgoLabel(year.yearsAgo)} sx={{ fontWeight: 600 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {year.year} · {year.photoCount} {year.photoCount === 1 ? 'photo' : 'photos'}
        </Typography>
      </Stack>

      {/* One row per year, scrolling sideways on its own: a busy day should not
          be able to push the album grid off the screen. */}
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
        {year.photos.map((photo) => {
          const src = photo.thumbnailSignedUrl || photo.signedUrl;

          return (
            <Tooltip key={photo._id} title={describe(photo)}>
              <Box
                component="button"
                type="button"
                onClick={() => onSelect(photo)}
                aria-label={describe(photo)}
                sx={{
                  width: size,
                  height: size,
                  flexShrink: 0,
                  p: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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

        {hidden > 0 && (
          <Box
            sx={{
              width: size,
              height: size,
              flexShrink: 0,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              +{hidden}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * Photos from this day in earlier years.
 *
 * Renders nothing at all when there is no history for today — an empty
 * "On this day" heading is worse than no heading, and most days in a young
 * library have nothing to show.
 */
const OnThisDay: React.FC<OnThisDayProps> = ({ groupId, size = THUMB_SIZE }) => {
  const navigate = useNavigate();
  const { memories, error } = useMemories(groupId);

  // Silent on both failure and emptiness: this is a bonus row above the albums,
  // never the reason someone came to the page.
  if (error || !memories || memories.years.length === 0) {
    return null;
  }

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: 2, mb: 4 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
          On this day
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          around {formatDay(memories.date)}
        </Typography>
      </Stack>

      <Stack spacing={2}>
        {memories.years.map((year) => (
          <MemoryYearRow
            key={year.year}
            year={year}
            size={size}
            onSelect={(photo) => navigate(`/albums/${photo.albumId}/photos/${photo._id}`)}
          />
        ))}
      </Stack>
    </Card>
  );
};

export default OnThisDay;
