import { useState } from 'react';
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ink, surface } from '@tumbaland/frontend-core';
import { formatCount } from '../../format';
import { vizVars } from './colors';

export interface Column {
  /** What the axis and the tooltip call it: a day, a week. */
  label: string;
  value: number;
}

interface ColumnChartProps {
  columns: Column[];
  /** What the numbers count, for the tooltip, the table and the screen reader: "active people". */
  noun: string;
  /** Names the chart for a screen reader. */
  title: string;
  height?: number;
}

/**
 * The parts of a bar that never change. The height and the hover dimming are
 * inline styles instead: through `sx` each distinct value is a generated class,
 * and a year of columns re-styled on every pointer move.
 */
const BAR = {
  width: '70%',
  maxWidth: 24,
  bgcolor: 'var(--viz)',
  // Rounded where the data ends, flat on the baseline.
  borderRadius: '4px 4px 0 0',
  transition: 'opacity .1s'
} as const;

/** The top of the scale, rounded up to a number worth printing: 7 becomes 8, 130 becomes 150. */
export function niceMax(value: number): number {
  if (value <= 4) return Math.max(value, 1);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * A column chart of one series.
 *
 * Plain HTML rather than a charting library, which is more than a handful of
 * bars warrants. The marks follow the data-viz specs: no thicker than 24px, a
 * 4px rounded end on a flat baseline, a hairline grid kept quiet, and values
 * only where asked for (the scale, and a tooltip on hover or focus), never a
 * number on every bar.
 *
 * Every column can be focused and reads out its value, and "Table" swaps the
 * chart for the same numbers, so nothing is only in the colour.
 */
export function ColumnChart({ columns, noun, title, height = 160 }: ColumnChartProps) {
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const max = niceMax(Math.max(0, ...columns.map((column) => column.value)));
  const axis = [max, max / 2, 0];
  const labelAt = new Set([0, Math.floor((columns.length - 1) / 2), columns.length - 1]);

  return (
    <Box sx={{ ...vizVars }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
        <Button size="small" onClick={() => setTable((on) => !on)} sx={{ textTransform: 'none', minHeight: 32 }}>
          {table ? 'Chart' : 'Table'}
        </Button>
      </Box>

      {table ? (
        <Box sx={{ maxHeight: height + 40, overflow: 'auto' }}>
          <Table size="small" aria-label={title}>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell align="right">{noun}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {columns.map((column, index) => (
                <TableRow key={index}>
                  <TableCell>{column.label}</TableCell>
                  <TableCell align="right">{formatCount(column.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* The scale, kept to three marks. */}
          <Box
            aria-hidden
            sx={{
              height,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textAlign: 'right',
              fontSize: 11,
              lineHeight: 1,
              color: ink.muted,
              minWidth: 28
            }}
          >
            {/* The middle mark is left blank when it would be half a person. */}
            {axis.map((mark, index) => (
              <span key={index}>{Number.isInteger(mark) ? formatCount(mark) : ''}</span>
            ))}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box role="group" aria-label={title} sx={{ position: 'relative', height }}>
              {[0, 50, 100].map((percent) => (
                <Box
                  key={percent}
                  aria-hidden
                  sx={{ position: 'absolute', left: 0, right: 0, bottom: `${percent}%`, height: '1px', bgcolor: surface.divider }}
                />
              ))}
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
                {columns.map((column, index) => (
                  <Box
                    key={index}
                    tabIndex={0}
                    role="img"
                    aria-label={`${column.label}: ${formatCount(column.value)} ${noun}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      position: 'relative',
                      outline: 'none',
                      '&:focus-visible': { outline: `2px solid ${ink.strong}`, outlineOffset: -2, borderRadius: 1 }
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={BAR}
                      style={{
                        height: `${(column.value / max) * 100}%`,
                        opacity: active === null || active === index ? 1 : 0.55
                      }}
                    />
                    {active === index && (
                      <Box
                        role="tooltip"
                        sx={{
                          position: 'absolute',
                          bottom: `calc(${(column.value / max) * 100}% + 8px)`,
                          left: index > columns.length / 2 ? 'auto' : '50%',
                          right: index > columns.length / 2 ? '50%' : 'auto',
                          zIndex: 1,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1.5,
                          bgcolor: ink.strong,
                          color: surface.paper,
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none'
                        }}
                      >
                        {column.label}: <strong>{formatCount(column.value)}</strong> {noun}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* The first, middle and last label: enough to read the scale of time without a wall of text. */}
            <Box aria-hidden sx={{ display: 'flex', mt: 0.5 }}>
              {columns.map((column, index) => (
                <Box key={index} sx={{ flex: 1, minWidth: 0, position: 'relative', height: 16 }}>
                  {labelAt.has(index) && (
                    <Typography
                      component="span"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: index === 0 ? 0 : index === columns.length - 1 ? 'auto' : '50%',
                        right: index === columns.length - 1 ? 0 : 'auto',
                        transform: index === 0 || index === columns.length - 1 ? 'none' : 'translateX(-50%)',
                        fontSize: 11,
                        color: ink.muted,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {column.label}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
