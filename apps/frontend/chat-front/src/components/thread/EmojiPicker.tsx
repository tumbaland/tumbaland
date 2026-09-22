import type React from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
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

/** Something to do with the message besides reacting to it, such as Edit. */
export interface MessageAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Drawn in the error colour, for the ones that cannot be taken back. */
  danger?: boolean;
}

export interface EmojiPickerProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** Absent where there is nowhere to escalate to, such as a test harness. */
  onMore?: (anchor: HTMLElement) => void;
  /**
   * Listed under the reactions. The same popover a long press opens, so a
   * phone reaches Edit and Unsend with the gesture it already knows.
   */
  actions?: MessageAction[];
}

export function EmojiPicker({ anchorEl, onClose, onPick, onMore, actions = [] }: EmojiPickerProps) {
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      // A pill while it is only the emoji row; a card once actions sit under it.
      slotProps={{
        paper: { sx: { borderRadius: actions.length > 0 ? 4 : 999, p: 0.5, bgcolor: surface.paper } }
      }}
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

      {actions.length > 0 && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <MenuList dense disablePadding aria-label="Message options">
            {actions.map((action) => (
              <MenuItem
                key={action.label}
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                sx={{ borderRadius: 2, minHeight: 40, color: action.danger ? 'error.main' : ink.body }}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>{action.icon}</ListItemIcon>
                <ListItemText>{action.label}</ListItemText>
              </MenuItem>
            ))}
          </MenuList>
        </>
      )}
    </Popover>
  );
}
