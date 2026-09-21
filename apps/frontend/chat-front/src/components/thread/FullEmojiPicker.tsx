import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Popover from '@mui/material/Popover';
import type { PopoverActions } from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { logger } from '@tumbaland/frontend-core';
import { brand, ink, surface } from '@tumbaland/frontend-core';

/**
 * The full, searchable emoji picker.
 *
 * `emoji-picker-element` is a web component, which is the reason it is safe
 * here: it holds no React and no context, so it needs no entry in
 * `TUMBALAND_FEDERATION_SHARED` and cannot introduce the second-copy-of-React
 * failure that a React picker would.
 *
 * Loaded on first open, never at import time. The whole point of the six quick
 * reactions elsewhere is that most taps never need this, and the emoji data is
 * far larger than anything else in the module. Bundling it eagerly would put
 * that weight into the federation chunk every person downloads to read a
 * message.
 */

let loader: Promise<void> | null = null;

/**
 * Imports the custom element, once per page.
 *
 * The promise is cached rather than the result, so two components opening at
 * the same moment share one download instead of racing two.
 */
export function loadEmojiPicker(): Promise<void> {
  if (!loader) {
    loader = import('emoji-picker-element')
      .then(() => undefined)
      .catch((error: Error) => {
        // Allows a later open to try again: a failed chunk fetch is usually a
        // deploy that moved the file, and a reload fixes it.
        loader = null;
        throw error;
      });
  }
  return loader;
}

/** Test seam: forgets the cached import. */
export function resetEmojiPickerLoader(): void {
  loader = null;
}

export interface FullEmojiPickerProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onPick: (emoji: string) => void;
}

interface EmojiClickEvent extends Event {
  detail: { unicode?: string };
}

export function FullEmojiPicker({ anchorEl, onClose, onPick }: FullEmojiPickerProps) {
  const open = Boolean(anchorEl);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const host = useRef<HTMLDivElement | null>(null);
  const popoverActions = useRef<PopoverActions>(null);
  /**
   * Whether the import has been started.
   *
   * A ref rather than reading `state`, because this effect *sets* `state`: with
   * it in the dependency list the effect re-runs the moment it flips to
   * "loading", and its cleanup tears down the in-flight load before the import
   * can resolve. The picker then sits on its spinner forever.
   */
  const started = useRef(false);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;

    setState('loading');
    loadEmojiPicker()
      .then(() => setState('ready'))
      .catch((error: Error) => {
        logger.warn('Emoji picker failed to load', { error: error.message });
        // Allows the next open to try again.
        started.current = false;
        setState('failed');
      });
  }, [open]);

  // The element is created by hand rather than written as JSX: a custom element
  // in JSX needs a global type declaration, and `emoji-click` is a DOM event
  // that React's synthetic system would not bind anyway.
  useEffect(() => {
    if (state !== 'ready' || !host.current) return;

    const element = document.createElement('emoji-picker');
    const onEmojiClick = (event: Event) => {
      const unicode = (event as EmojiClickEvent).detail?.unicode;
      if (unicode) {
        onPick(unicode);
        onClose();
      }
    };

    element.addEventListener('emoji-click', onEmojiClick);
    host.current.replaceChildren(element);

    return () => {
      element.removeEventListener('emoji-click', onEmojiClick);
      element.remove();
    };
  }, [state, onPick, onClose]);

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => popoverActions.current?.updatePosition());
    const observer = host.current ? new ResizeObserver(() => popoverActions.current?.updatePosition()) : null;
    if (observer && host.current) observer.observe(host.current);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [open, state]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      action={popoverActions}
      onClose={onClose}
      marginThreshold={8}
      transitionDuration={0}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: surface.paper,
            width: 'min(360px, calc(100vw - 16px))',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: 'calc(100vh - 16px)'
          }
        }
      }}
    >
      {state === 'failed' ? (
        <Box sx={{ p: 2, maxWidth: 260 }}>
          <Typography variant="body2" sx={{ color: ink.muted }}>
            The emoji picker could not load. Reload the page and try again.
          </Typography>
        </Box>
      ) : state === 'ready' ? (
        <Box
          ref={host}
          sx={{
            // The element styles itself through custom properties rather than
            // a stylesheet, so the theme is handed to it this way.
            '& emoji-picker': {
              '--background': surface.paper,
              '--button-active-background': `${brand.pinkInk}22`,
              '--button-hover-background': surface.sunken,
              '--indicator-color': brand.pinkInk,
              '--num-columns': 8,
              width: '100%',
              height: 'min(400px, calc(100vh - 96px))',
              maxHeight: 'calc(100vh - 96px)',
              display: 'block'
            }
          }}
        />
      ) : (
        <Box sx={{ display: 'grid', placeItems: 'center', width: 280, height: 200 }}>
          <CircularProgress size={22} />
        </Box>
      )}
    </Popover>
  );
}
