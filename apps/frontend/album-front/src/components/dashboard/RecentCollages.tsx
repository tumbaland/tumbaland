import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { GridOn as GridOnIcon } from '@mui/icons-material';
import { useCollageList } from '../../hooks/useCollage';
import { CollagePreview } from '../collage/CollageCard';
import { Collage } from '../../types/collage';
import { appPath } from '../../appBase';

/**
 * Four is what fits one row on a laptop and two on a phone without the tiles
 * shrinking to the point where a layout is no longer readable as a layout.
 */
const MAX_TILES = 4;

const formatEdited = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The collages worked on most recently, as a way back into them.
 *
 * Silent while loading, on failure, and when there are none — the same rule
 * `OnThisDay` follows. A heading over four empty boxes is worse than no
 * heading, and a dashboard must not fail because one card's query did.
 */
const RecentCollages: React.FC = () => {
  const navigate = useNavigate();
  const { data, error } = useCollageList();

  const recent = React.useMemo<Collage[]>(
    () =>
      [...(data ?? [])]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, MAX_TILES),
    [data]
  );

  if (error || recent.length === 0) {
    return null;
  }

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', p: { xs: 1.25, sm: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <GridOnIcon color="primary" sx={{ fontSize: { xs: 20, sm: 24 } }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Recent collages
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => navigate(appPath('/collages'))} sx={{ flexShrink: 0 }}>
          See all
        </Button>
      </Stack>

      {/* Two across on a phone, four from `sm`. Fixed fractions rather than a
          minimum width, so the row can only ever be as wide as the card. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: `repeat(${MAX_TILES}, minmax(0, 1fr))` },
          gap: { xs: 1, sm: 1.5 }
        }}
      >
        {recent.map((collage) => (
          <Box
            key={collage._id}
            component="button"
            type="button"
            // `?mode=view` — the list page opens a collage this way too. Without it
            // the route mounts the full editor, which is not what tapping a
            // thumbnail on a dashboard asks for.
            onClick={() => navigate(appPath(`/collages/${collage._id}?mode=view`))}
            aria-label={`${collage.title}, edited ${formatEdited(collage.updatedAt)}`}
            sx={{
              p: 0,
              textAlign: 'left',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
            }}
          >
            <CollagePreview collage={collage} />
            <Box sx={{ px: 1, py: 0.75, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                {collage.title}
              </Typography>
              <Typography noWrap variant="caption" sx={{ color: 'text.secondary' }}>
                {formatEdited(collage.updatedAt)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

export default RecentCollages;
