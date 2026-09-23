import React from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Typography,
  alpha
} from '@mui/material';
import { Flag, Celebration } from '@mui/icons-material';
import { useTenantFilter, useActivePalette } from '@tumbaland/frontend-core';
import { useMilestones } from '../hooks/useMilestones';
import { Milestone } from '../services/statistics';

interface MilestonesCardProps {
  /** how many rows each column shows */
  maxItems?: number;
}

/** YYYY-MM-DD read as a local day, so a UTC-midnight key never renders as the day before. */
const formatDay = (day: string): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

const inLabel = (days: number): string => {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
};

const agoLabel = (days: number): string => {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
};

/**
 * A count milestone is worth a progress bar — it is a fraction of a known
 * target. A date milestone is not: the target is a day, and its distance is
 * already spelled out in words.
 */
const progressOf = (milestone: Milestone): number | null =>
  milestone.remaining !== undefined && milestone.target > 0
    ? Math.min(100, ((milestone.target - milestone.remaining) / milestone.target) * 100)
    : null;

const timingOf = (milestone: Milestone): string => {
  const when = milestone.daysAway !== undefined ? inLabel(milestone.daysAway) : '';
  // A projection is an estimate, so it is hedged in the wording as well as in
  // the tooltip — never presented as a date that is already settled.
  return milestone.projected ? `~${when}` : when;
};

const tooltipOf = (milestone: Milestone): string => {
  if (milestone.achievedOn) return `Reached ${formatDay(milestone.achievedOn)}`;
  if (!milestone.expectedOn) return milestone.label;
  return milestone.projected
    ? `${milestone.remaining} to go — around ${formatDay(milestone.expectedOn)} at your current pace`
    : `Falls on ${formatDay(milestone.expectedOn)}`;
};

interface MilestoneListProps {
  icon: React.ReactNode;
  title: string;
  emptyText: string;
  accent: string;
  milestones: Milestone[];
}

const MilestoneList: React.FC<MilestoneListProps> = ({ icon, title, emptyText, accent, milestones }) => (
  <Card elevation={0} sx={{ height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1, sm: 1.5 }, color: accent }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {title}
        </Typography>
      </Box>

      {milestones.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {emptyText}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {milestones.map((milestone) => {
            const dot = milestone.color || accent;
            const progress = progressOf(milestone);

            return (
              <Tooltip key={milestone.key} title={tooltipOf(milestone)}>
                <Box sx={{ px: 1, py: 0.75, borderRadius: 1.5, bgcolor: alpha(accent, 0.07) }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: dot }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>
                      {milestone.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: accent, whiteSpace: 'nowrap' }}
                    >
                      {milestone.achievedOn ? agoLabel(milestone.daysAgo ?? 0) : timingOf(milestone)}
                    </Typography>
                  </Box>

                  {progress !== null && (
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      aria-label={`${milestone.label} progress`}
                      sx={{
                        mt: 0.75,
                        height: 4,
                        borderRadius: 2,
                        bgcolor: alpha(dot, 0.15),
                        '& .MuiLinearProgress-bar': { bgcolor: dot }
                      }}
                    />
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}
    </CardContent>
  </Card>
);

/**
 * The forward-looking half of the dashboard's momentum story: the round numbers
 * just passed and the ones close enough to aim at. Where `StreakCards` says
 * what has gone quiet, this says what is worth showing up for.
 */
const MilestonesCard: React.FC<MilestonesCardProps> = ({ maxItems = 4 }) => {
  const palette = useActivePalette();
  const tenantGroupId = useTenantFilter();
  const { milestones, loading, error } = useMilestones(tenantGroupId);

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

  // Nothing logged and no start date configured — there is no milestone to
  // count towards yet, and the empty dashboard already says as much.
  if (!milestones || (milestones.upcoming.length === 0 && milestones.recent.length === 0)) {
    return null;
  }

  return (
    <Box>
      <Typography
        variant="h5"
        component="h2"
        sx={{ fontWeight: 'bold', color: 'text.primary', fontSize: { xs: '1.1rem', sm: '1.5rem' }, mb: { xs: 1.5, sm: 3 } }}
      >
        Milestones
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gap: { xs: 1.5, sm: 3 }
        }}
      >
        <MilestoneList
          icon={<Flag />}
          title="Coming up"
          emptyText="Nothing on the horizon just yet."
          accent={palette.primary.main}
          milestones={milestones.upcoming.slice(0, maxItems)}
        />
        <MilestoneList
          icon={<Celebration />}
          title="Just reached"
          emptyText="No milestones passed recently."
          accent={palette.success.main}
          milestones={milestones.recent.slice(0, maxItems)}
        />
      </Box>
    </Box>
  );
};

export default MilestonesCard;
