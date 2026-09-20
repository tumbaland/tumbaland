import { Box, ButtonBase, Typography } from '@mui/material';
import { glass, ink, moduleAccent } from '@tumbaland/frontend-core';
import { SectionLabel } from './SectionLabel';
import type { RecentActivity as Entry } from '../../services/homeApi';

interface RecentActivityProps {
  activities: Entry[];
  onOpen: (route: string) => void;
}

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
export function RecentActivity({ activities, onOpen }: RecentActivityProps) {
  if (activities.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="home-recent-activity">
      <SectionLabel id="home-recent-activity">Recently logged</SectionLabel>
      <Box sx={{ ...glass, overflow: 'hidden' }}>
        {activities.map((entry, index) => {
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
