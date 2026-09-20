import { useEffect, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { surface } from '@tumbaland/frontend-core';

/** Placement from the caller (width, transform), merged over the frame's own look. */
type FrameSx = Record<string, unknown>;

/**
 * The size every screen inside a frame is drawn at, whatever size the frame
 * ends up on the page.
 *
 * A phone screen on this page is 150px wide on the narrowest phone and 260px
 * on a desktop. Laying the contents out responsively at both would mean a
 * second set of breakpoints inside a 150px box, and text that ends up either
 * unreadable or comically large. So each screen is written once against this
 * fixed canvas and the whole thing is scaled to the frame, the way a
 * screenshot would be, except it stays sharp and can still animate.
 */
export const SCREEN = { width: 300, height: 620 } as const;

interface PhoneFrameProps {
  children: ReactNode;
  sx?: FrameSx;
  /**
   * What the screen is, for a reader who cannot see it. Left off for a screen
   * that is pure decoration beside a heading that already says it, which also
   * keeps a staged screenful of entries from being read out as though it were
   * someone's real journal.
   */
  label?: string;
}

/** A phone around one of the mock screens. */
export function PhoneFrame({ children, sx, label }: PhoneFrameProps) {
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!screen) return;

    // Unmeasurable width (jsdom, a display:none ancestor) means an unscaled
    // screen rather than one collapsed to nothing.
    const measure = () => setScale(screen.clientWidth > 0 ? screen.clientWidth / SCREEN.width : 1);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [screen]);

  return (
    <Box
      sx={{
        p: '5px',
        borderRadius: '30px',
        flexShrink: 0,
        background: 'linear-gradient(165deg, #3b3251 0%, #1b1428 100%)',
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: '0 26px 52px -26px rgba(124,58,237,0.75)',
        ...sx
      }}
    >
      <Box
        ref={setScreen}
        data-testid="phone-screen"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${SCREEN.width} / ${SCREEN.height}`,
          borderRadius: '26px',
          overflow: 'hidden',
          background: surface.page
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SCREEN.width,
            height: SCREEN.height,
            transformOrigin: 'top left',
            transform: `scale(${scale})`
          }}
        >
          {children}
        </Box>

        {/* The speaker slot, which is most of what makes a rectangle read as a
            phone. Over the screen, so a screen never has to leave room for it. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '1.4%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '26%',
            height: 4,
            borderRadius: 2,
            background: 'rgba(15,23,42,0.22)'
          }}
        />
      </Box>
    </Box>
  );
}

export default PhoneFrame;
