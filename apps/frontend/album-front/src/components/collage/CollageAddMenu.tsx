import React from 'react';
import { Box, Button, ButtonBase, Popover, Typography } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import { COLLAGE_SHAPES, CollageShape, SHAPE_LABELS, SHAPE_PATHS, STICKERS } from '@tumbaland/collage-core';

/** The colour a new shape starts in. */
export const DEFAULT_SHAPE_COLOR = '#e91e63';

interface CollageAddMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onAddSticker: (emoji: string) => void;
  onAddShape: (shape: CollageShape) => void;
  onAddDate: () => void;
}

/**
 * Everything besides photos and plain text that can go on a collage:
 * stickers, shapes, and the date. Picking one adds it and closes the menu.
 */
const CollageAddMenu: React.FC<CollageAddMenuProps> = ({ anchorEl, onClose, onAddSticker, onAddShape, onAddDate }) => {
  const pick = (action: () => void) => () => {
    action();
    onClose();
  };
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{ paper: { sx: { p: 1.5, width: 320, maxWidth: 'calc(100vw - 32px)' } } }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        Stickers
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.25 }}>
        {STICKERS.map((emoji) => (
          <ButtonBase
            key={emoji}
            aria-label={`Add sticker ${emoji}`}
            onClick={pick(() => onAddSticker(emoji))}
            sx={{ fontSize: 24, aspectRatio: '1', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
          >
            {emoji}
          </ButtonBase>
        ))}
      </Box>

      <Typography variant="overline" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
        Shapes
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {COLLAGE_SHAPES.map((shape) => (
          <ButtonBase
            key={shape}
            aria-label={`Add ${SHAPE_LABELS[shape].toLowerCase()}`}
            title={SHAPE_LABELS[shape]}
            onClick={pick(() => onAddShape(shape))}
            sx={{ width: 38, height: 38, p: 0.75, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
              <path d={SHAPE_PATHS[shape]} fill={DEFAULT_SHAPE_COLOR} />
            </svg>
          </ButtonBase>
        ))}
      </Box>

      <Button startIcon={<EventIcon />} onClick={pick(onAddDate)} size="small" sx={{ mt: 1, textTransform: 'none' }}>
        Add today&apos;s date
      </Button>
    </Popover>
  );
};

export default CollageAddMenu;
