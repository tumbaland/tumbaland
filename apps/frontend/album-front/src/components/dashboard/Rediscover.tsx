import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Button, Card, Skeleton, Stack, Typography } from '@mui/material';
import { AutoAwesome as SparkleIcon, Casino as ShuffleIcon } from '@mui/icons-material';
import { useRandomPhoto } from '../../hooks/useHighlights';
import { HighlightPhoto } from '../../types';
import { appPath } from '../../appBase';

/** How long ago, in the words a person would use rather than a date. */
const howLongAgo = (iso: string, now: Date): string => {
  const months = Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44));

  if (months < 1) return 'this month';
  if (months < 2) return 'last month';
  if (months < 12) return `${months} months ago`;

  const years = Math.floor(months / 12);
  return years === 1 ? 'a year ago' : `${years} years ago`;
};

const formatExact = (photo: HighlightPhoto): string => {
  const when = new Date(photo.takenAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return photo.dateSource === 'uploaded' ? `${when} (uploaded)` : when;
};

interface RediscoverProps {
  groupId?: string;
}

/**
 * One photo, picked at random from the whole library.
 *
 * "On this day" only has something to say on a day that happens to have
 * history, and most days in a young library do not. This card always has
 * something, and what it has is the part of a photo library nobody ever scrolls
 * back far enough to reach.
 *
 * The pick is deliberately sticky — see `useRandomPhoto`. A photo that changed
 * by itself while being looked at is the one thing this card must not do, so
 * only the button moves it.
 */
const Rediscover: React.FC<RediscoverProps> = ({ groupId }) => {
  const navigate = useNavigate();
  const { photo, loading, isFetching, error, showAnother } = useRandomPhoto(groupId);
  const now = React.useMemo(() => new Date(), []);

  // Silent on failure and on an empty library, like the other strips. Loading
  // gets a skeleton rather than nothing, because unlike the others this card
  // always ends up with something to show — so its space is never wasted.
  if (error || (!loading && !photo)) {
    return null;
  }

  const src = photo ? photo.signedUrl || photo.thumbnailSignedUrl : undefined;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: { xs: 1.25, sm: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <SparkleIcon color="primary" sx={{ fontSize: { xs: 20, sm: 24 } }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Remember this?
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<ShuffleIcon />}
          onClick={() => showAnother()}
          disabled={isFetching}
          sx={{ flexShrink: 0 }}
        >
          Show another
        </Button>
      </Stack>

      {loading || !photo ? (
        <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 2 }} />
      ) : (
        <Box
          component="button"
          type="button"
          onClick={() => navigate(appPath(`/albums/${photo.albumId}/photos/${photo._id}`))}
          aria-label={`${photo.title || photo.originalName}, ${formatExact(photo)}, from ${photo.albumName}`}
          sx={{
            p: 0,
            width: '100%',
            display: 'block',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <Box
            component="img"
            src={src}
            alt={photo.title || photo.originalName}
            loading="lazy"
            sx={{
              width: '100%',
              // Full-bleed on a phone, capped beyond it. At `width: 100%` on a
              // desktop dashboard the 4:3 box grew with the column and turned
              // one photo into most of the page.
              maxWidth: { xs: '100%', sm: 440 },
              // Tall enough to be worth looking at, short enough that the rest
              // of the dashboard is still reachable without scrolling past a
              // single picture.
              aspectRatio: '4 / 3',
              objectFit: 'cover',
              borderRadius: 2,
              display: 'block',
              bgcolor: 'action.hover'
            }}
          />
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, mt: 1, flexWrap: 'wrap', minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem' }} noWrap>
              {howLongAgo(photo.takenAt, now)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {formatExact(photo)} · {photo.albumName}
            </Typography>
          </Stack>
        </Box>
      )}
    </Card>
  );
};

export default Rediscover;
