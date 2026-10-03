import { Box, ButtonBase, LinearProgress, Typography } from '@mui/material';
import { glass, ink, moduleAccent, surface } from '@tumbaland/frontend-core';
import { SectionLabel } from './SectionLabel';
import type { Milestone, Milestones } from '../../services/homeApi';

interface HomeMilestonesProps {
  milestones: Milestones;
  onOpen: (route: string) => void;
}

/** How many of each kind the section shows. The dashboard has the rest. */
const MAX_UPCOMING = 3;
const MAX_RECENT = 2;

/** "in 3 days", "tomorrow": how far off a coming milestone is. */
export function inLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/** How long ago a reached milestone was. */
export function agoLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

/** A projected date is a guess from the current pace, so it says "about". */
function timing(milestone: Milestone): string {
  if (milestone.achievedOn) return agoLabel(milestone.daysAgo ?? 0);
  const when = inLabel(milestone.daysAway ?? 0);
  return milestone.projected ? when.replace(/^In /, 'In about ') : when;
}

/** The share of a count milestone already done, or null for a date milestone, which has no fraction. */
export function progressOf(milestone: Milestone): number | null {
  return milestone.remaining !== undefined && milestone.target > 0
    ? Math.min(100, ((milestone.target - milestone.remaining) / milestone.target) * 100)
    : null;
}

/** What sits on the right of a row: how much is left for a count, else how far off or how long ago. */
export function headline(milestone: Milestone): string {
  if (!milestone.achievedOn && milestone.remaining !== undefined) return `${milestone.remaining} to go`;
  return timing(milestone);
}

/**
 * Milestones on the home page: how long the two of them have been together,
 * what is coming up, and what was just reached.
 *
 * The day count is the part that is different every morning, which is the
 * test for anything at the top of this page. The rows under it are the same
 * ones the relationship dashboard shows, cut down to the few worth a glance.
 *
 * Renders nothing before there is a start date or an entry to count from.
 */
export function HomeMilestones({ milestones, onOpen }: HomeMilestonesProps) {
  const upcoming = milestones.upcoming.slice(0, MAX_UPCOMING);
  const recent = milestones.recent.slice(0, MAX_RECENT);
  const days = milestones.daysTogether;
  if (days == null && upcoming.length === 0 && recent.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="home-milestones">
      <SectionLabel id="home-milestones">Milestones</SectionLabel>
      <Box sx={{ ...glass, overflow: 'hidden' }}>
        {days != null && (
          <Box sx={{ px: { xs: 1.75, md: 2.25 }, py: 1.5 }}>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 700, color: ink.strong, lineHeight: 1.25 }}>
              {days.toLocaleString()} {days === 1 ? 'day' : 'days'} together
            </Typography>
          </Box>
        )}
        {/* Both groups always show, as on the relationship dashboard: a group
            with nothing in it says so, rather than leaving the reader to wonder
            whether it was left out. */}
        <MilestoneGroup
          title="Coming up"
          emptyText="Nothing on the horizon just yet."
          milestones={upcoming}
          onOpen={onOpen}
        />
        <MilestoneGroup
          title="Just reached"
          emptyText="No milestones passed recently."
          milestones={recent}
          onOpen={onOpen}
        />
      </Box>
    </Box>
  );
}

interface MilestoneGroupProps {
  title: string;
  emptyText: string;
  milestones: Milestone[];
  onOpen: (route: string) => void;
}

function MilestoneGroup({ title, emptyText, milestones, onOpen }: MilestoneGroupProps) {
  return (
    <Box sx={{ borderTop: `1px solid ${surface.divider}` }}>
      <Typography
        component="h3"
        sx={{ px: { xs: 1.75, md: 2.25 }, pt: 1.25, pb: 0.25, fontSize: 12, fontWeight: 700, color: ink.muted }}
      >
        {title}
      </Typography>
      {milestones.length === 0 ? (
        <Typography sx={{ px: { xs: 1.75, md: 2.25 }, pt: 0.5, pb: 1.5, fontSize: '0.9rem', color: ink.muted }}>
          {emptyText}
        </Typography>
      ) : (
        milestones.map((milestone) => {
          const dot = milestone.color || moduleAccent.journal;
          const progress = milestone.achievedOn ? null : progressOf(milestone);
          return (
            <ButtonBase
              key={milestone.key}
              onClick={() => onOpen('/relationship/dashboard')}
              sx={{
                width: '100%',
                display: 'block',
                px: { xs: 1.75, md: 2.25 },
                py: 1.25,
                textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
                '&:hover, &:active': { background: surface.hover }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, backgroundColor: dot }} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem', fontWeight: 600, color: ink.strong }}>
                  {milestone.label}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: progress === null ? 400 : 600, color: ink.muted, flexShrink: 0 }}>
                  {headline(milestone)}
                </Typography>
              </Box>
              {/* A count has a fraction, so it gets a bar, with its projected
                  date beside it. A date milestone's distance is already in words. */}
              {progress !== null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75, pl: 2.75 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    aria-label={`${milestone.label} progress`}
                    sx={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      bgcolor: `${dot}26`,
                      '& .MuiLinearProgress-bar': { bgcolor: dot }
                    }}
                  />
                  {milestone.daysAway !== undefined && (
                    <Typography sx={{ fontSize: '0.75rem', color: ink.muted, flexShrink: 0 }}>{timing(milestone)}</Typography>
                  )}
                </Box>
              )}
            </ButtonBase>
          );
        })
      )}
    </Box>
  );
}

export default HomeMilestones;
