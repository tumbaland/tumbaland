import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ink } from '@tumbaland/frontend-core';

export interface TypingIndicatorProps {
  names: string[];
}

/** Three dots and a name. Renders nothing when nobody is typing. */
export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const label =
    names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(' and ')} are typing`;

  return (
    <Box
      aria-live="polite"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 0.5, minHeight: 24 }}
    >
      <Box sx={{ display: 'flex', gap: 0.4 }} aria-hidden>
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: ink.muted,
              animation: 'chat-typing 1.2s infinite ease-in-out',
              animationDelay: `${index * 0.16}s`,
              '@keyframes chat-typing': {
                '0%, 60%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
                '30%': { opacity: 1, transform: 'translateY(-3px)' }
              },
              // Respects the system setting: a looping animation is exactly
              // what "reduce motion" is asking about.
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.5 }
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: ink.muted }}>
        {label}
      </Typography>
    </Box>
  );
}
