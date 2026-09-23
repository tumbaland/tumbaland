import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Popover from '@mui/material/Popover';
import type { PopoverActions } from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
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
  /**
   * The box the element goes into, as state rather than a ref.
   *
   * The popover renders through a portal that attaches its content one render
   * after `open` flips. An effect keyed on a ref ran in the render before that,
   * found no box, and only tried again if the parent happened to re-render --
   * which typing does and tapping the message box or photo button does not.
   * The paper then opened empty: a thin line where the picker should be.
   * Holding the node in state re-runs the effect the moment the box exists.
   */
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // Read through refs, so a parent re-rendering with new inline callbacks does
  // not tear the picker down and rebuild it, losing its search and scroll.
  const onPickRef = useRef(onPick);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onPickRef.current = onPick;
    onCloseRef.current = onClose;
  }, [onPick, onClose]);
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
    if (state !== 'ready' || !host) return;

    const element = document.createElement('emoji-picker');
    const onEmojiClick = (event: Event) => {
      const unicode = (event as EmojiClickEvent).detail?.unicode;
      if (unicode) {
        onPickRef.current(unicode);
        onCloseRef.current();
      }
    };

    element.addEventListener('emoji-click', onEmojiClick);
    host.replaceChildren(element);

    return () => {
      element.removeEventListener('emoji-click', onEmojiClick);
      element.remove();
    };
  }, [state, host]);

  // Left alone, the element follows the device's light or dark rather than the
  // app's, which differ whenever someone has picked one in Appearance. Its own
  // `light`/`dark` class overrides that. Separate from the effect above so a
  // switch restyles the picker rather than rebuilding it.
  const { colorScheme } = useColorScheme();
  useEffect(() => {
    const element = host?.querySelector('emoji-picker');
    if (!element || !colorScheme) return;
    element.classList.remove('light', 'dark');
    element.classList.add(colorScheme);
  }, [state, host, colorScheme]);

  useEffect(() => {
    if (!open) return;

    const reposition = () => popoverActions.current?.updatePosition();
    const frame = requestAnimationFrame(reposition);
    const observer = host ? new ResizeObserver(reposition) : null;
    if (observer && host) observer.observe(host);
    // Tapping the emoji button from the message box closes the phone's
    // keyboard, which moves the button after the popover has measured it.
    window.visualViewport?.addEventListener('resize', reposition);
    window.addEventListener('resize', reposition);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.visualViewport?.removeEventListener('resize', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [open, host]);

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
            maxHeight: 'calc(100dvh - 16px)'
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
          ref={setHost}
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
              // `dvh`: on a phone `vh` is the height with the browser's bars
              // hidden, so a picker sized by it runs off the screen.
              height: 'min(400px, calc(100dvh - 96px))',
              maxHeight: 'calc(100dvh - 96px)',
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
