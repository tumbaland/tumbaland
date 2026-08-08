import { Box, IconButton, Typography } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useTodo } from '../../hooks/useTodo';

/**
 * Shared line box for the label, the text and the reroll button. The three have
 * different intrinsic heights, so pinning them all to one value is what keeps
 * them on the same line when the text wraps.
 */
const LINE_HEIGHT = '22px';

/**
 * The old home page was this and nothing else. Kept as a small strip at the
 * bottom — it is a nice piece of personality, but it should not be the first
 * thing a signed-in user sees instead of their own content.
 */
export function DailyTodo() {
  const { todo, isLoading, error, fetchTodo } = useTodo();

  return (
    <Box
      sx={{
        mt: { xs: 4, md: 5 },
        mx: 'auto',
        maxWidth: 620,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        // Rounded rectangle rather than a pill: the text wraps to two or three
        // lines for longer entries, and a 999px radius looks broken once it does.
        borderRadius: 3,
        background: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.65)'
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#c026d3',
          flexShrink: 0,
          // Same line box as the body text below, so the label sits on the
          // first line rather than floating above it once the text wraps.
          lineHeight: LINE_HEIGHT
        }}
      >
        Idea
      </Typography>
      <Typography
        // Full text on hover, since a very long entry is still clamped.
        title={!error && todo ? todo : undefined}
        sx={{
          flex: 1,
          // Without this a flex child refuses to shrink below its content
          // width, and the clamp never engages.
          minWidth: 0,
          fontSize: '0.92rem',
          lineHeight: LINE_HEIGHT,
          color: error ? '#ef4444' : '#334155',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          overflowWrap: 'anywhere'
        }}
      >
        {error ? 'Could not load an idea' : todo || 'Loading…'}
      </Typography>
      <IconButton
        aria-label="Show another idea"
        size="small"
        disabled={isLoading}
        onClick={fetchTodo}
        // Pulls the ~29px button back onto the 22px first line.
        sx={{ color: '#ff1fae', flexShrink: 0, mt: '-4px', mr: '-4px' }}
      >
        <AutorenewIcon sx={{ fontSize: 19 }} />
      </IconButton>
    </Box>
  );
}

export default DailyTodo;
