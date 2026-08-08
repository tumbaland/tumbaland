import { Box, Typography } from '@mui/material';

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
        sx={{
          fontFamily: '"Pacifico", cursive',
          fontSize: { xs: 34, sm: 44, md: 52 },
          lineHeight: 1.25,
          background: 'linear-gradient(135deg, #ff1fae 0%, #8b5cf6 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
          letterSpacing: 1,
          px: 2,
          pb: 1
        }}
      >
        {first ? `${timeOfDayGreeting(now)}, ${first}` : 'Welcome to Tumbaland'}
      </Typography>
      <Typography sx={{ color: '#475569', fontSize: { xs: '0.98rem', md: '1.05rem' } }}>
        Everything you keep here, in one place. Where would you like to start?
      </Typography>
    </Box>
  );
}

export default GreetingHeader;
