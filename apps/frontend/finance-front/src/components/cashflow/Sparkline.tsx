import React, { useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

export interface SparkPoint {
  label: string;
  value: number;
}

interface SparklineProps {
  points: SparkPoint[];
  color: string;
  /** Formats a value for the tooltip. */
  format: (value: number) => string;
  /** Screen-reader description; the shape alone says nothing without it. */
  label: string;
  height?: number;
}

const WIDTH = 240;
const PAD = 4;

/**
 * A twelve-point shape for a stat tile: enough to see whether the headline
 * number is a plateau or the middle of a climb.
 *
 * Hoverable, because a plot that shows a shape and will not say what any of it
 * was invites the reader to guess at values off an axis that isn't there. The
 * crosshair reads out the period and the amount instead.
 */
const Sparkline: React.FC<SparklineProps> = ({ points, color, format, label, height = 40 }) => {
  const [active, setActive] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = high - low || 1;
  // Inset by the marker radius so a point at either extreme is not half cut off.
  const x = (i: number) => (i / (points.length - 1)) * (WIDTH - PAD * 2) + PAD;
  const y = (v: number) => height - PAD - ((v - low) / span) * (height - PAD * 2);

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ');

  const last = points.length - 1;
  const marked = active ?? last;

  /** Nearest point to the pointer, in the element's own coordinates. */
  const track = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * last));
  };

  const shown = points[marked];
  // Keep the readout inside the box at both ends rather than letting it clip.
  const anchor = marked / last;

  return (
    <Box sx={{ mt: 1, position: 'relative' }}>
      <Box
        ref={boxRef}
        onMouseMove={(e) => track(e.clientX)}
        onMouseLeave={() => setActive(null)}
        sx={{ lineHeight: 0, cursor: 'crosshair', position: 'relative' }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={label}
          preserveAspectRatio="none"
        >
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.45}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* The marker and crosshair are HTML, not SVG. The plot stretches to
            whatever width it is given (preserveAspectRatio="none"), which is
            right for the line and squashes a <circle> into an oval — an HTML
            dot keeps its shape at any width. */}
        {active !== null && (
          <Box
            data-testid="sparkline-crosshair"
            sx={{
              position: 'absolute',
              left: `${(x(active) / WIDTH) * 100}%`,
              top: 0,
              height,
              borderLeft: '1px solid',
              borderColor: color,
              opacity: 0.3,
              pointerEvents: 'none'
            }}
          />
        )}
        <Box
          data-testid="sparkline-marker"
          sx={{
            position: 'absolute',
            left: `${(x(marked) / WIDTH) * 100}%`,
            top: y(shown.value),
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: color,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        />
      </Box>

      {/* Always rendered, so the row does not jump as the pointer enters. It
          reads out the newest period until something is hovered. */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 0.25,
          color: 'text.secondary',
          textAlign: anchor < 0.25 ? 'left' : anchor > 0.75 ? 'right' : 'center'
        }}
      >
        {shown.label}: {format(shown.value)}
      </Typography>
    </Box>
  );
};

export default Sparkline;
