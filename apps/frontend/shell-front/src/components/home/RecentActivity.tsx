import { Box, ButtonBase, Typography } from '@mui/material';
import { glass, ink, moduleAccent } from '@tumbaland/frontend-core';
import { SectionLabel } from './SectionLabel';
import type { RecentActivity as Entry } from '../../services/homeApi';

interface RecentActivityProps {
  activities: Entry[];
  onOpen: (route: string) => void;
  /** Injectable so the week's boundary is testable without freezing the clock. */
  now?: Date;
}

/** How far back "this week" reaches. */
const WEEK_DAYS = 7;

/** How many rows the section will show, however much is in the window. */
const MAX_ROWS = 6;

/** "Today", "Yesterday", then the date — the way anyone would say it out loud. */
export function whenLabel(date: string, now: Date = new Date()): string {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return '';

  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
      86_400_000
  );

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Whole days between two dates, so a late evening and the next morning are one day apart. */
function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000
  );
}

export interface RecentWindow {
  entries: Entry[];
  /** True when every entry shown falls inside the last week. */
  withinWeek: boolean;
}

/**
 * The last week's entries, or the latest few when the week was a quiet one.
 *
 * Seven days back from now, not the calendar week: on a Monday morning a
 * calendar week is empty and says nothing, which is the opposite of what this
 * section is for. The heading says "Last 7 days" rather than "This week" for
 * the same reason — the two mean different things, and this is the rolling one.
 *
 * A strict week would still empty the section on exactly the weeks it most
 * needs to say something, and an empty section on the home page reads as a
 * broken one. Falling back to the most recent entries keeps it honest instead:
 * the dates beside them still say "three weeks ago", and the heading stops
 * claiming the week.
 */
export function windowEntries(activities: Entry[], now: Date = new Date()): RecentWindow {
  const dated = activities.filter((entry) => !Number.isNaN(new Date(entry.date).getTime()));
  const week = dated.filter((entry) => {
    const days = daysBetween(new Date(entry.date), now);
    // Future-dated entries are plans, not things that happened this week.
    return days >= 0 && days < WEEK_DAYS;
  });

  if (week.length > 0) return { entries: week.slice(0, MAX_ROWS), withinWeek: true };
  return { entries: dated.slice(0, 3), withinWeek: false };
}

/** What the entry actually says: its own words, else the kind of thing it was. */
export function entryTitle(entry: Entry): string {
  const described = entry.description?.trim();
  if (described) return described;
  if (entry.hours) return `${entry.hours}h ${entry.typeId?.name ?? 'together'}`;
  return entry.typeId?.name ?? 'Logged';
}

/**
 * The last few things written in the journal.
 *
 * The home page had no way of showing that anything had been written at all,
 * which made it read the same on a day full of entries as on an empty one.
 * These are the entries themselves, not a count: seeing "Sushi House,
 * yesterday" is what makes the journal feel kept rather than maintained.
 */
export function RecentActivity({ activities, onOpen, now = new Date() }: RecentActivityProps) {
  const { entries, withinWeek } = windowEntries(activities, now);
  if (entries.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="home-recent-activity">
      <SectionLabel id="home-recent-activity">{withinWeek ? 'Last 7 days' : 'Last logged'}</SectionLabel>
      <Box sx={{ ...glass, overflow: 'hidden' }}>
        {entries.map((entry, index) => {
          const accent = entry.typeId?.color || moduleAccent.journal;
          return (
            <ButtonBase
              key={entry._id}
              onClick={() => onOpen('/relationship/journal')}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 1.5,
                px: { xs: 1.75, md: 2.25 },
                py: 1.25,
                textAlign: 'left',
                borderTop: index === 0 ? 'none' : '1px solid rgba(15,23,42,0.06)',
                WebkitTapHighlightColor: 'transparent',
                '&:hover, &:active': { background: 'rgba(255,255,255,0.5)' }
              }}
            >
              {/* A dot in the type's own colour: enough to tell two kinds of
                  entry apart in a list without giving every row an icon tile. */}
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: accent, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600, color: ink.strong, lineHeight: 1.35 }}>
                  {entryTitle(entry)}
                </Typography>
                {entry.location?.name && (
                  <Typography noWrap sx={{ fontSize: '0.8rem', color: ink.muted }}>
                    {entry.location.name}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: ink.muted, flexShrink: 0 }}>
                {whenLabel(entry.date)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export default RecentActivity;
