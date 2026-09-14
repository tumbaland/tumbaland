import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { LocalFireDepartment, EmojiEvents, HistoryToggleOff } from '@mui/icons-material';
import { useTenantFilter } from '@tumbaland/components';
import { useStreaks } from '../hooks/useStreaks';
import { TypeCadence } from '../services/statistics';
import StatCard from './StatCard';

interface StreakCardsProps {
  /** types the dashboard is configured to hide — never nudged about */
  hiddenTypeIds: string[];
  /** how many nudges to show at once */
  maxNudges?: number;
}

/** A type that has been logged often enough to have a rhythm to fall behind. */
type Nudge = TypeCadence & { typicalGapDays: number; overdueRatio: number };

/** A type is worth mentioning once it has gone past its own usual gap. */
const OVERDUE_THRESHOLD = 1;
/** …and reads as urgent at twice that gap. */
const URGENT_THRESHOLD = 2;

const dayCount = (days: number): string => (days === 1 ? '1 day' : `${days} days`);

const lastTimeLabel = (days: number): string => {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

/** YYYY-MM-DD read as a local day, so a UTC-midnight key never renders as the day before. */
const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

/**
 * The dashboard's opinion: how long the logging streak is, and which activity
 * types have gone quiet relative to their own rhythm — a type done weekly is
 * overdue after ten days, one done twice a year is not.
 */
const StreakCards: React.FC<StreakCardsProps> = ({ hiddenTypeIds, maxNudges = 4 }) => {
  const theme = useTheme();
  const tenantGroupId = useTenantFilter();
  const { streaks, loading, error } = useStreaks(tenantGroupId);

  const hidden = useMemo(() => new Set(hiddenTypeIds), [hiddenTypeIds]);

  // Already sorted most-overdue-first by the API; only types with an
  // established rhythm can be judged overdue at all.
  const nudges = useMemo(
    () =>
      (streaks?.types ?? [])
        .filter(
          (type): type is Nudge =>
            !hidden.has(type.typeId) &&
            type.typicalGapDays !== null &&
            type.overdueRatio !== null &&
            type.overdueRatio > OVERDUE_THRESHOLD
        )
        .slice(0, maxNudges),
    [streaks, hidden, maxNudges]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Nothing logged yet — the empty dashboard already says as much. A null
  // daysSinceLastEntry is exactly that case, and narrowing on it here keeps the
  // cards below free of "if there is a last entry" noise.
  if (!streaks || streaks.daysSinceLastEntry === null) {
    return null;
  }
  const daysSinceLastEntry = streaks.daysSinceLastEntry;

  const { longestStreakStart: from, longestStreakEnd: to } = streaks;
  const longestRange = !from || !to
    ? 'no streak yet'
    : from === to
      ? formatDay(from)
      : `${formatDay(from)} → ${formatDay(to)}`;

  return (
    <Box>
      <Typography
        variant="h5"
        component="h2"
        sx={{ fontWeight: 'bold', color: 'text.primary', fontSize: { xs: '1.1rem', sm: '1.5rem' }, mb: { xs: 1.5, sm: 3 } }}
      >
        Momentum
      </Typography>

      {/* Two per row on a phone. The third figure and the "it has been a
          while" list each take a full row there, since neither reads at half
          width. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 1.5, sm: 3 }
        }}
      >
        <StatCard
          icon={<LocalFireDepartment />}
          title="Current Streak"
          value={dayCount(streaks.currentStreak)}
          subtitle={
            streaks.currentStreak > 0
              ? 'consecutive days logged'
              : `nothing logged for ${dayCount(daysSinceLastEntry)}`
          }
          color={streaks.currentStreak > 0 ? theme.palette.warning.main : theme.palette.text.disabled}
        />
        <StatCard
          icon={<EmojiEvents />}
          title="Longest Streak"
          value={dayCount(streaks.longestStreak)}
          subtitle={longestRange}
          color={theme.palette.secondary.main}
        />
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          <StatCard
            icon={<HistoryToggleOff />}
            title="Days Logged"
            value={streaks.totalLoggedDays}
            subtitle={`most recent: ${lastTimeLabel(daysSinceLastEntry)}`}
            color={theme.palette.info.main}
          />
        </Box>

        {/* Fourth cell beside the stat cards: one slim line per type — a colour dot,
            the name, how long it has been, and the rhythm it is judged against.
            Exact dates live in the tooltip. */}
        <Card
          elevation={0}
          sx={{
            gridColumn: { xs: '1 / -1', sm: 'auto' },
            height: '100%',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {nudges.length > 0 ? 'It has been a while since…' : 'Nothing overdue'}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
              {nudges.map((type) => {
                const urgent = type.overdueRatio >= URGENT_THRESHOLD;
                const accent = urgent ? theme.palette.error.main : theme.palette.warning.main;
                const gap = Math.max(1, Math.round(type.typicalGapDays));

                return (
                  <Tooltip
                    key={type.typeId}
                    title={`Last logged ${formatDay(type.lastDate)} — usually every ${gap} days`}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1.5,
                        bgcolor: alpha(accent, 0.07)
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          bgcolor: type.color || accent
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>
                        {type.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: accent, whiteSpace: 'nowrap' }}>
                        {type.daysSince}d
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        · every {gap}d
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default StreakCards;
