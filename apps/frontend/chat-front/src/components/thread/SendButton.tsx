import { useRef, useState, type PointerEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CheckIcon from '@mui/icons-material/Check';
import SendIcon from '@mui/icons-material/Send';
import { TOUCH_TARGET, ink, surface } from '@tumbaland/frontend-core';
import { EFFECTS } from './effects';
import type { MessageEffect } from '../../types';

/** How long Send must be held before it offers effects instead of sending. */
const HOLD_MS = 450;

interface SendButtonProps {
  /** Saving an edit rather than sending a new message. */
  editing: boolean;
  disabled: boolean;
  /** Whether holding or right-clicking offers effects: for a new message only. */
  offerEffects: boolean;
  /** The conversation theme's colour. */
  accent: string;
  /** Sends with the effect the person chose from the menu. A plain tap submits the form instead. */
  onSendWithEffect: (effect: MessageEffect) => void;
}

/**
 * The submit button. Holding it, or right-clicking, offers to send with an
 * effect: the gesture other chat apps use for the same thing, which keeps a
 * plain tap a plain send.
 */
export function SendButton({ editing, disabled, offerEffects, accent, onSendWithEffect }: SendButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set once a hold has opened the menu, so letting go does not also send. */
  const held = useRef(false);

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const startHold = (event: PointerEvent<HTMLElement>) => {
    held.current = false;
    if (!offerEffects || event.button !== 0) return;
    const target = event.currentTarget;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setAnchor(target);
    }, HOLD_MS);
  };

  return (
    <>
      <IconButton
        type="submit"
        aria-label={editing ? 'Save edit' : 'Send'}
        aria-haspopup={offerEffects ? 'menu' : undefined}
        disabled={disabled}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(event) => {
          if (!offerEffects) return;
          event.preventDefault();
          cancelHold();
          setAnchor(event.currentTarget);
        }}
        onClick={(event) => {
          // The press that opened the menu ends in a click; it chose nothing yet.
          if (held.current) {
            event.preventDefault();
            held.current = false;
          }
        }}
        sx={{
          width: TOUCH_TARGET,
          height: TOUCH_TARGET,
          // A long press on a phone would otherwise select or preview the button.
          WebkitTouchCallout: 'none',
          userSelect: 'none',
          color: '#fff',
          bgcolor: accent,
          '&:hover': { bgcolor: accent, filter: 'brightness(0.94)' },
          '&.Mui-disabled': { bgcolor: surface.sunken, color: ink.muted }
        }}
      >
        {editing ? <CheckIcon fontSize="small" /> : <SendIcon fontSize="small" />}
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        // Sending puts the focus back in the message box; handing it to the
        // Send button on close would take it away again.
        disableRestoreFocus
      >
        {EFFECTS.map((effect) => (
          <MenuItem
            key={effect.id}
            onClick={() => {
              setAnchor(null);
              onSendWithEffect(effect.id);
            }}
          >
            <Box component="span" aria-hidden sx={{ fontSize: 20, mr: 1.5, lineHeight: 1 }}>
              {effect.emoji}
            </Box>
            {effect.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
