import Box from '@mui/material/Box';
import { keyframes } from '@emotion/react';
import type { MessageEffect } from '../../types';
import { BUBBLE_GLYPHS } from './effects';

export interface BubbleEffectProps {
  effect: MessageEffect;
  /** Which side the bubble sits on, so the side glyph goes on the open side. */
  mine: boolean;
}

const popIn = keyframes`
  0% { transform: scale(0) rotate(var(--tilt)); opacity: 0; }
  70% { transform: scale(1.3) rotate(var(--tilt)); opacity: 1; }
  100% { transform: scale(1) rotate(var(--tilt)); opacity: 1; }
`;

const bob = keyframes`
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -3px; }
`;

/**
 * Where the glyphs sit, around the bubble's edge.
 *
 * Mostly on the top and bottom edges, overlapping the corners: the bubble's
 * outer side is up against the edge of the thread, and anything placed past
 * it would be cut off.
 */
const SPOTS = (mine: boolean) => [
  { top: -12, left: -8, size: 17, tilt: -15 },
  { top: -14, left: '45%', size: 12, tilt: 8 },
  { top: -11, right: -6, size: 16, tilt: 14 },
  { bottom: -10, left: -9, size: 13, tilt: 10 },
  { bottom: -12, right: '30%', size: 12, tilt: -8 },
  { top: '35%', ...(mine ? { left: -18 } : { right: -18 }), size: 14, tilt: mine ? -12 : 12 }
];

/** Small glyphs around a bubble sent with an effect. They stay, so it still reads as special later. */
export function BubbleEffect({ effect, mine }: BubbleEffectProps) {
  const glyphs = BUBBLE_GLYPHS[effect];

  return (
    <Box aria-hidden data-testid={`bubble-effect-${effect}`} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {SPOTS(mine).map(({ size, tilt, ...place }, index) => (
        <Box
          key={index}
          component="span"
          style={{ '--tilt': `${tilt}deg` } as Record<string, string>}
          sx={{
            position: 'absolute',
            ...place,
            fontSize: size,
            lineHeight: 1,
            transform: `rotate(${tilt}deg)`,
            // Popped on one after another, then a slow drift so it reads as
            // alive rather than as a sticker.
            animation: `${popIn} .45s cubic-bezier(.3,1.5,.5,1) ${index * 0.07}s both, ${bob} ${2.6 + index * 0.3}s ease-in-out ${0.5 + index * 0.2}s infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
          }}
        >
          {glyphs[index % glyphs.length]}
        </Box>
      ))}
    </Box>
  );
}
