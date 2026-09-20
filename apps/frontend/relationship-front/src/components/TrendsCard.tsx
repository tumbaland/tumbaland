import React, { useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat, FiberNew, DoNotDisturbOn } from '@mui/icons-material';
import { useTenantFilter } from '@tumbaland/frontend-core';
import { useTrends } from '../hooks/useTrends';
import { TrendDirection, TypeTrend } from '../services/statistics';

interface TrendsCardProps {
  /** how many type rows to list */
  maxItems?: number;
}

/** Window lengths the card offers; all inside the range the endpoint accepts. */
const WINDOW_OPTIONS = [7, 30, 90] as const;

const windowLabel = (days: number): string =>
  days === 7 ? 'Last 7 days' : days === 90 ? 'Last 90 days' : `Last ${days} days`;

/** YYYY-MM-DD read as a local day, so a UTC-midnight key never renders as the day before. */
const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Hours are summed as integers by the API, so they never need decimals here;
 * the count is what varies, and a bare number reads fastest in a dense row.
 */
const countLabel = (value: number, singular: string, plural: string): string =>
  `${value} ${value === 1 ? singular : plural}`;

/**
 * The chip's wording. A percentage needs a baseline to divide by, so a type
 * with an empty previous window gets a plain count instead of "+∞%" — and one
 * that stopped is called that rather than "-100%", which reads like a rounding.
 */
const changeLabel = (direction: TrendDirection, delta: number, pct: number | null): string => {
  if (direction === 'new') return `+${delta} new`;
  if (direction === 'stopped') return 'stopped';
  if (direction === 'flat') return 'no change';
  if (pct === null) return `${delta > 0 ? '+' : ''}${delta}`;
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

const DIRECTION_ICONS: Record<TrendDirection, React.ReactElement> = {
  up: <TrendingUp fontSize="small" />,
  down: <TrendingDown fontSize="small" />,
  flat: <TrendingFlat fontSize="small" />,
  new: <FiberNew fontSize="small" />,
  stopped: <DoNotDisturbOn fontSize="small" />
};

interface ChangeChipProps {
  direction: TrendDirection;
  delta: number;
  pct: number | null;
  tooltip: string;
}

const ChangeChip: React.FC<ChangeChipProps> = ({ direction, delta, pct, tooltip }) => {
  const theme = useTheme();
  // 'new' is growth and 'stopped' is a fall, so they take the same colours as
  // up and down — the icon is what tells the two pairs apart.
  const color =
    direction === 'up' || direction === 'new'
      ? theme.palette.success.main
      : direction === 'down' || direction === 'stopped'
        ? theme.palette.error.main
        : theme.palette.text.secondary;

  return (
    <Tooltip title={tooltip}>
      <Chip
        size="small"
        icon={DIRECTION_ICONS[direction]}
        label={changeLabel(direction, delta, pct)}
        sx={{
          fontWeight: 600,
          color,
          bgcolor: alpha(color, 0.12),
          '& .MuiChip-icon': { color }
        }}
      />
    </Tooltip>
  );
};

interface SummaryTileProps {
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
  direction: TrendDirection;
}

const SummaryTile: React.FC<SummaryTileProps> = ({ label, current, previous, delta, pct, direction }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 }, mt: 0.5 }}>
      <Typography
        variant="h5"
        component="p"
        sx={{ fontWeight: 'bold', fontSize: { xs: '1.15rem', sm: '1.5rem' }, lineHeight: 1.2 }}
      >
        {current}
      </Typography>
      <ChangeChip
        direction={direction}
        delta={delta}
        pct={pct}
        tooltip={`${previous} in the window before`}
      />
    </Box>
  </Box>
);

interface TrendRowProps {
  trend: TypeTrend;
  /** the busiest window across every listed row, so the bars share a scale */
  scale: number;
}

/**
 * One type, as two bars on a shared scale: what it did before, and what it is
 * doing now. Sharing the scale across rows is the point — a bar that only ever
 * filled its own row would make a type logged twice look like one logged fifty.
 */
const TrendRow: React.FC<TrendRowProps> = ({ trend, scale }) => {
  const theme = useTheme();
  const color = trend.color || theme.palette.primary.main;
  const bar = (value: number, dim: boolean) => (
    <LinearProgress
      variant="determinate"
      value={scale > 0 ? Math.min(100, (value / scale) * 100) : 0}
      aria-label={`${trend.name} ${dim ? 'previous' : 'current'} window`}
      sx={{
        height: dim ? 4 : 6,
        borderRadius: 2,
        bgcolor: alpha(color, 0.12),
        '& .MuiLinearProgress-bar': { bgcolor: dim ? alpha(color, 0.4) : color }
      }}
    />
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: color }} />
        <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>
          {trend.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {trend.previous.entries} → {trend.current.entries}
        </Typography>
        <ChangeChip
          direction={trend.direction}
          delta={trend.entriesDelta}
          pct={trend.entriesChangePct}
          tooltip={`${countLabel(trend.current.entries, 'entry', 'entries')} on ${countLabel(
            trend.current.activeDays,
            'day',
            'days'
          )}, against ${trend.previous.entries} on ${countLabel(
            trend.previous.activeDays,
            'day',
            'days'
          )} before`}
        />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {bar(trend.current.entries, false)}
        {bar(trend.previous.entries, true)}
      </Box>
    </Box>
  );
};

/**
 * Which way things are moving right now. `StreakCards` says what has gone
 * quiet and `MilestonesCard` says what is worth aiming at; this sits between
 * them, comparing the recent window against the one before it so a type that
 * is quietly fading shows up long before it reads as overdue.
 */
const TrendsCard: React.FC<TrendsCardProps> = ({ maxItems = 6 }) => {
  const tenantGroupId = useTenantFilter();
  const [windowDays, setWindowDays] = useState<number>(30);
  const { trends, loading, error } = useTrends(windowDays, tenantGroupId);

  const header = (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: { xs: 1.5, sm: 3 } }}>
      <Typography
        variant="h5"
        component="h2"
        sx={{ fontWeight: 'bold', color: 'text.primary', fontSize: { xs: '1.1rem', sm: '1.5rem' } }}
      >
        Trends
      </Typography>
      <FormControl size="small" sx={{ minWidth: { xs: 124, sm: 140 } }}>
        <InputLabel id="trends-window-label">Window</InputLabel>
        <Select
          labelId="trends-window-label"
          value={windowDays}
          label="Window"
          onChange={(e) => setWindowDays(Number(e.target.value))}
          sx={{ borderRadius: 2 }}
        >
          {WINDOW_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {windowLabel(option)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  // Only the first load gets a bare spinner. Once there is a result, changing
  // the window refetches with the old rows still on screen, so the selector the
  // user just used does not vanish out from under them.
  if (loading && !trends) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Nothing logged in either window — there is no movement to describe, and the
  // rest of the dashboard already says the scope is empty.
  if (!trends || trends.types.length === 0) {
    return null;
  }

  const { totals } = trends;
  const rows = trends.types.slice(0, maxItems);
  const scale = Math.max(...rows.flatMap((trend) => [trend.current.entries, trend.previous.entries]));

  return (
    <Box>
      {header}

      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        {loading && <LinearProgress aria-label="Loading trends" sx={{ height: 2 }} />}
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontSize: { xs: '0.75rem', sm: '0.875rem' }, mb: { xs: 1, sm: 2 } }}
          >
            {formatDay(trends.currentStart)} – {formatDay(trends.currentEnd)} against{' '}
            {formatDay(trends.previousStart)} – {formatDay(trends.previousEnd)}
          </Typography>

          {/* The three totals side by side even on a phone: stacked, each took
              a row of its own for a single number. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: { xs: 1, sm: 2 }
            }}
          >
            <SummaryTile
              label="Entries"
              current={totals.current.entries}
              previous={totals.previous.entries}
              delta={totals.entriesDelta}
              pct={totals.entriesChangePct}
              direction={totals.direction}
            />
            <SummaryTile
              label="Active days"
              current={totals.current.activeDays}
              previous={totals.previous.activeDays}
              delta={totals.activeDaysDelta}
              pct={null}
              direction={
                totals.activeDaysDelta > 0 ? 'up' : totals.activeDaysDelta < 0 ? 'down' : 'flat'
              }
            />
            <SummaryTile
              label="Hours"
              current={totals.current.hours}
              previous={totals.previous.hours}
              delta={totals.hoursDelta}
              pct={totals.hoursChangePct}
              direction={totals.hoursDelta > 0 ? 'up' : totals.hoursDelta < 0 ? 'down' : 'flat'}
            />
          </Box>

          <Divider sx={{ my: { xs: 1.5, sm: 2.5 } }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 2 } }}>
            {rows.map((trend) => (
              <TrendRow key={trend.typeId} trend={trend} scale={scale} />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TrendsCard;
