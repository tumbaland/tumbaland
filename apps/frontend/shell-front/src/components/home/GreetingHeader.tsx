import { Box, Typography } from '@mui/material';
import { ink, wordmark } from '../../theme/tokens';

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

export function GreetingHeader({ name, now = new Date() }: GreetingHeaderProps) {
  const first = firstNameOf(name);

  return (
    <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 5 } }}>
      <Typography
        component="h1"
        sx={{ ...wordmark, fontSize: { xs: 34, sm: 44, md: 52 }, px: 2 }}
      >
        {first ? `${timeOfDayGreeting(now)}, ${first}` : 'Welcome to Tumbaland'}
      </Typography>
      <Typography sx={{ color: ink.body, fontSize: { xs: '0.98rem', md: '1.05rem' } }}>
        Everything you keep here, in one place. Where would you like to start?
      </Typography>
    </Box>
  );
}

export default GreetingHeader;
