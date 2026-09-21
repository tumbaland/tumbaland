import type React from 'react';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import { ink, surface } from '@tumbaland/frontend-core';
import { loadEmojiPicker } from './FullEmojiPicker';

/**
 * The quick reactions.
 *
 * Six emoji cover almost every reaction anyone actually sends, and they cost
 * nothing to show. Anything else is behind the "more" button, which loads the
 * full searchable picker on demand rather than putting its emoji database into
 * the chunk every person downloads to read a message.
 */
export const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'] as const;

export interface EmojiPickerProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** Absent where there is nowhere to escalate to, such as a test harness. */
  onMore?: (anchor: HTMLElement) => void;
}

export function EmojiPicker({ anchorEl, onClose, onPick, onMore }: EmojiPickerProps) {
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slotProps={{ paper: { sx: { borderRadius: 999, p: 0.5, bgcolor: surface.paper } } }}
    >
      <Box sx={{ display: 'flex', gap: 0.25 }} role="group" aria-label="Pick a reaction">
        {QUICK_REACTIONS.map((emoji) => (
          <Box
            key={emoji}
            component="button"
            type="button"
            aria-label={emoji}
            onClick={() => {
              onPick(emoji);
              onClose();
            }}
            sx={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 22,
              lineHeight: 1,
              // Comfortably tappable without making the row huge.
              width: 40,
              height: 40,
              borderRadius: '50%',
              transition: 'transform .12s ease, background-color .12s ease',
              '&:hover': { backgroundColor: surface.sunken, transform: 'scale(1.15)' },
              '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: -2 }
            }}
          >
            <span aria-hidden>{emoji}</span>
          </Box>
        ))}

        {onMore && (
          <Box
            component="button"
            type="button"
            aria-label="More emoji"
            onPointerEnter={() => void loadEmojiPicker().catch(() => {})}
            onFocus={() => void loadEmojiPicker().catch(() => {})}
            onClick={(event: React.MouseEvent<HTMLElement>) => {
              const anchor = event.currentTarget;
              onClose();
              onMore(anchor);
            }}
            sx={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: ink.muted,
              '&:hover': { backgroundColor: surface.sunken },
              '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: -2 }
            }}
          >
            <AddCircleOutlineIcon fontSize="small" />
          </Box>
        )}
      </Box>
    </Popover>
  );
}
