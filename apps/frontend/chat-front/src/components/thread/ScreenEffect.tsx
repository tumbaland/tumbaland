import { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { keyframes } from '@emotion/react';
import type { MessageEffect } from '../../types';

export interface ScreenEffectProps {
  effect: MessageEffect;
  /** Called once the last piece has left the screen, so the layer can go. */
  onDone: () => void;
}

// Hearts drift up from the bottom edge, like the ones in a live stream.
const rise = keyframes`
  0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
  10% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(var(--drift), -105vh) scale(var(--scale)) rotate(var(--spin)); opacity: 0; }
`;

// Kisses land all over the screen like stamps, then lift away.
const stamp = keyframes`
  0% { transform: scale(0) rotate(var(--spin)); opacity: 0; }
  15% { transform: scale(1.35) rotate(var(--spin)); opacity: 1; }
  25% { transform: scale(1) rotate(var(--spin)); }
  75% { transform: translateY(0) scale(1) rotate(var(--spin)); opacity: 1; }
  100% { transform: translateY(-12vh) scale(0.8) rotate(var(--spin)); opacity: 0; }
`;

// Confetti falls from the top, turning over as it goes.
const fall = keyframes`
  0% { transform: translate(0, 0) rotate(0deg) rotateY(0deg); opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translate(var(--drift), 108vh) rotate(var(--spin)) rotateY(720deg); opacity: 0; }
`;

const HEARTS = ['❤️', '💕', '💖', '💗', '❤️', '💘'];
const KISSES = ['💋', '😘', '💋', '😚', '💋'];
const CONFETTI_COLOURS = ['#ff4d8d', '#ffc233', '#4dc9ff', '#7ae582', '#b18cff', '#ff8a4d'];

interface Piece {
  left: number;
  top: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  spin: number;
  scale: number;
  glyph: string;
  colour: string;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;

const COUNTS: Record<MessageEffect, number> = { hearts: 26, kisses: 16, confetti: 90 };

function pieces(effect: MessageEffect): Piece[] {
  return Array.from({ length: COUNTS[effect] }, () => ({
    left: random(2, 95),
    top: random(8, 80),
    delay: random(0, effect === 'confetti' ? 0.6 : 1.1),
    duration: effect === 'confetti' ? random(2.2, 3.4) : effect === 'kisses' ? random(1.6, 2.2) : random(2.4, 3.4),
    size: effect === 'confetti' ? random(6, 11) : random(22, 40),
    drift: random(-60, 60),
    spin: effect === 'confetti' ? random(-540, 540) : random(-25, 25),
    scale: random(0.9, 1.4),
    glyph: pick(effect === 'kisses' ? KISSES : HEARTS),
    colour: pick(CONFETTI_COLOURS)
  }));
}

/**
 * A burst across the thread when a message with an effect arrives.
 *
 * Drawn over the thread and never in the way of it: nothing here takes a
 * click, and it is gone in about four seconds. Someone who has asked their
 * device for less motion gets none of it.
 */
export function ScreenEffect({ effect, onDone }: ScreenEffectProps) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const drawn = useMemo(() => pieces(effect), [effect]);
  const lasts = Math.max(...drawn.map((piece) => piece.delay + piece.duration));

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return;
    }
    const timer = setTimeout(onDone, lasts * 1000 + 100);
    return () => clearTimeout(timer);
    // The pieces are fixed for the life of one burst; a new burst remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <Box
      aria-hidden
      data-testid={`screen-effect-${effect}`}
      sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 20 }}
    >
      {drawn.map((piece, index) => {
        const vars = {
          '--drift': `${piece.drift}px`,
          '--spin': `${piece.spin}deg`,
          '--scale': piece.scale
        } as Record<string, string | number>;
        const timing = `${piece.duration}s cubic-bezier(.25,.6,.4,1) ${piece.delay}s both`;

        if (effect === 'confetti') {
          return (
            <Box
              key={index}
              style={vars}
              sx={{
                position: 'absolute',
                top: -16,
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.6,
                borderRadius: index % 3 === 0 ? '50%' : '2px',
                bgcolor: piece.colour,
                animation: `${fall} ${piece.duration}s linear ${piece.delay}s both`
              }}
            />
          );
        }

        return (
          <Box
            key={index}
            style={vars}
            sx={{
              position: 'absolute',
              left: `${piece.left}%`,
              ...(effect === 'hearts' ? { bottom: -48 } : { top: `${piece.top}%` }),
              fontSize: piece.size,
              lineHeight: 1,
              animation: `${effect === 'hearts' ? rise : stamp} ${timing}`
            }}
          >
            {piece.glyph}
          </Box>
        );
      })}
    </Box>
  );
}
