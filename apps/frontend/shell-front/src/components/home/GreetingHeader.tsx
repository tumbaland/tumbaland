import { Box, Typography } from '@mui/material';
import { brand, gradient, ink } from '@tumbaland/components';

interface GreetingHeaderProps {
  name?: string;
  /** Injectable so the greeting is testable without freezing the clock. */
  now?: Date;
}

export function timeOfDayGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstNameOf(name?: string): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

/** e.g. "Monday 14 September". */
export function formatToday(now: Date): string {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * The top of the home page, set the way a phone app sets a screen title: the
 * date small above, the greeting large and left-aligned under it.
 *
 * It was a centred script greeting over a line of copy, which reads as a web
 * page's hero rather than the first screen of an app, and took a quarter of a
 * phone's height before anything could be tapped.
 */
export function GreetingHeader({ name, now = new Date() }: GreetingHeaderProps) {
  const first = firstNameOf(name);

  return (
    <Box component="header">
      <Typography
        sx={{
          fontSize: { xs: 12, md: 13 },
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: brand.purple,
          mb: 0.5
        }}
      >
        {formatToday(now)}
      </Typography>
      <Typography
        component="h1"
        sx={{
          fontSize: { xs: '1.85rem', md: '2.5rem' },
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.12,
          color: ink.strong
        }}
      >
        {first ? (
          <>
            {timeOfDayGreeting(now)},{' '}
            <Box
              component="span"
              sx={{
                background: gradient.brand,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {first}
            </Box>
          </>
        ) : (
          'Welcome to Tumbaland'
        )}
      </Typography>
    </Box>
  );
}

export default GreetingHeader;
