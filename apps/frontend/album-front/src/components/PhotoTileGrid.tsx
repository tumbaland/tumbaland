import { Box, Tooltip, alpha, useTheme } from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';
import { MediaThumb } from '@tumbaland/frontend-core';
import { Photo } from '../types';
import { mediaPreview } from '../utils/mediaPreview';

/**
 * How many photos the row shows, by screen width. The strips that use this
 * share it, so their rows line up column for column.
 *
 * Every returned photo used to sit in a row that scrolled sideways, which on a
 * phone pushed the whole page past the screen edge. The fix capped the row at
 * four and spent the fourth slot on a `+5` counter, but a counter is a dead
 * tile: it shows nothing, and it cannot be clicked. The extra photos are simply
 * not drawn now, and a wider screen draws more of them, so resizing reveals
 * them rather than trading one away to say they exist.
 */
export const TILES_BY_WIDTH = { xs: 4, sm: 6, md: 8 } as const;

interface PhotoTileGridProps<P extends Photo> {
  photos: P[];
  /** What the tooltip and the button's label say about a photo. */
  describe: (photo: P) => string;
  onSelect: (photo: P) => void;
  maxWidth?: Record<string, string | number>;
}

/**
 * A single row of square photo buttons.
 *
 * Every photo given is rendered and CSS decides how many are on screen. Slicing
 * to a width read in JavaScript would need a resize listener and would still be
 * a frame behind. The columns are fixed and sized from the card, never from the
 * photos, so the row is only ever as wide as the space it is given; the tiles
 * past the column count are hidden rather than dropped, and widening the window
 * brings them in.
 */
export function PhotoTileGrid<P extends Photo>({ photos, describe, onSelect, maxWidth }: PhotoTileGridProps<P>) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: `repeat(${TILES_BY_WIDTH.xs}, minmax(0, 1fr))`,
          sm: `repeat(${TILES_BY_WIDTH.sm}, minmax(0, 1fr))`,
          md: `repeat(${TILES_BY_WIDTH.md}, minmax(0, 1fr))`
        },
        gap: 1,
        ...(maxWidth ? { maxWidth } : {})
      }}
    >
      {photos.slice(0, TILES_BY_WIDTH.md).map((photo, index) => {
        const { src, mimetype } = mediaPreview(photo);

        return (
          <Tooltip key={photo._id} title={describe(photo)}>
            <Box
              component="button"
              type="button"
              onClick={() => onSelect(photo)}
              aria-label={describe(photo)}
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: 2,
                alignItems: 'center',
                justifyContent: 'center',
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
                  mimetype={mimetype}
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
}
