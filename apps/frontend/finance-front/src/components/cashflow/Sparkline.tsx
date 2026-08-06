import React from 'react';
import { Box } from '@mui/material';

interface SparklineProps {
  values: number[];
  /** Which point is "now" — drawn in the series colour, the rest recede. */
  highlight?: number;
  color: string;
  /** Screen-reader description; the shape alone says nothing without it. */
  label: string;
  height?: number;
}

const WIDTH = 240;

/**
 * A twelve-point shape for a stat tile: enough to see whether the headline
 * number is a plateau or the middle of a climb, without asking anyone to read
 * values off it. Deliberately unlabelled and unaxised — the number above it is
 * the measurement, this is only its shape.
 */
const Sparkline: React.FC<SparklineProps> = ({ values, highlight, color, label, height = 34 }) => {
  if (values.length < 2) return null;

  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = high - low || 1;
  // Inset by the marker radius so a point at either extreme is not half cut off.
  const pad = 4;
  const x = (i: number) => (i / (values.length - 1)) * (WIDTH - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - low) / span) * (height - pad * 2);

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const marked = highlight ?? values.length - 1;

  return (
    <Box sx={{ mt: 1, lineHeight: 0 }}>
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
        <circle cx={x(marked)} cy={y(values[marked])} r={4} fill={color} />
      </svg>
    </Box>
  );
};

export default Sparkline;
