import React from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  type Palette,
  type SxProps,
  type Theme
} from '@mui/material';
import type { XAxis } from '@mui/x-charts';
import { journalYears } from '../utils/years';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 2025" for a monthly row, the label the month axis splits on. */
export const monthLabel = (item: { month: string; year: number }): string =>
  `${MONTHS[parseInt(item.month) - 1]} ${item.year}`;

/**
 * A band axis of `monthLabel`s that ticks only the year, at the first month
 * and at each January, and shows the full label in the tooltip.
 */
export const monthAxis = (labels: string[]): XAxis<'band'> => ({
  scaleType: 'band',
  data: labels,
  tickLabelStyle: { angle: 0, textAnchor: 'middle', fontSize: 12 },
  valueFormatter: (value: string, context) => {
    if (context.location !== 'tick') return value;
    const [month, year] = value.split(' ');
    return value === labels[0] || month === 'Jan' ? year : '';
  }
});

/**
 * Text colour that reads on `background`, in the scheme showing. Chart colours
 * come from the palette or from a user's activity type, so no fixed white or
 * grey works on all of them in both light and dark.
 */
export const readableOn = (palette: Palette, background: string): string => {
  try {
    return palette.getContrastText(background);
  } catch {
    // `transparent`, or a colour MUI cannot parse: it sits on the card itself.
    return palette.text.primary;
  }
};

/** A pill filled with `background`, its label in whichever colour reads on it. */
export const chipColors = (palette: Palette, background: string) => ({
  backgroundColor: background,
  color: readableOn(palette, background)
});

/** The label drawn on a bar: bold, in the colour that reads on that bar. */
export const barLabelOn =
  (palette: Palette, fontSize: string, style: React.CSSProperties = {}) =>
  ({ color }: { color: string }) => ({
    style: { fill: readableOn(palette, color), fontSize, fontWeight: 'bold', ...style }
  });

const Centered: React.FC<{ height: number; children: React.ReactNode }> = ({ height, children }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>{children}</Box>
);

interface ChartCardProps {
  title: string;
  height: number;
  loading: boolean;
  error: string | null;
  /** Nothing to draw: shows "No data available" instead of the chart. */
  empty: boolean;
  /** Controls beside the title once there is data, usually a `YearSelect`. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * The card every dashboard chart sits in. Until there is something to draw it
 * shows the title over a spinner, the error, or "No data available".
 */
export const ChartCard: React.FC<ChartCardProps> = ({ title, height, loading, error, empty, actions, children }) => {
  let placeholder: React.ReactNode = null;
  if (loading) {
    placeholder = (
      <Centered height={height}>
        <CircularProgress />
      </Centered>
    );
  } else if (error) {
    placeholder = <Alert severity="error">{error}</Alert>;
  } else if (empty) {
    placeholder = (
      <Centered height={height}>
        <Typography sx={{ color: 'text.secondary' }}>No data available</Typography>
      </Centered>
    );
  }

  return (
    <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <CardContent>
        {placeholder ? (
          <>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              {title}
            </Typography>
            {placeholder}
          </>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 2
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {title}
              </Typography>
              {actions}
            </Box>
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface YearSelectProps {
  /** undefined is "All Years". */
  value: number | undefined;
  onChange: (year: number | undefined) => void;
}

/** Picks one journal year, or all of them. */
export const YearSelect: React.FC<YearSelectProps> = ({ value, onChange }) => (
  <FormControl size="small" sx={{ minWidth: 120 }}>
    <InputLabel>Year</InputLabel>
    <Select
      value={value || 'all'}
      label="Year"
      onChange={(e) => onChange(e.target.value === 'all' ? undefined : Number(e.target.value))}
      sx={{ borderRadius: 2 }}
    >
      <MenuItem value="all">All Years</MenuItem>
      {journalYears().map((year) => (
        <MenuItem key={year} value={year}>
          {year}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export interface ChartStat {
  label: string;
  value: React.ReactNode;
  /** Colour of the number; the theme's primary when left out. */
  color?: string;
}

/** The row of headline numbers under a chart, each over its label. */
export const ChartStats: React.FC<{ stats: ChartStat[]; sx?: SxProps<Theme> }> = ({ stats, sx }) => (
  <Box
    sx={[
      {
        mt: 2,
        display: 'flex',
        justifyContent: 'space-around',
        pt: 2,
        borderTop: '1px solid var(--mui-palette-divider)',
        flexWrap: 'wrap',
        gap: { xs: 2, sm: 0 }
      },
      ...(Array.isArray(sx) ? sx : [sx])
    ]}
  >
    {stats.map((stat) => (
      <Box key={stat.label} sx={{ textAlign: 'center', minWidth: { xs: '80px', sm: 'auto' } }}>
        <Typography
          variant="h6"
          sx={{ color: stat.color ?? 'primary.main', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
        >
          {stat.value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
          {stat.label}
        </Typography>
      </Box>
    ))}
  </Box>
);
