import { Box, IconButton, Typography } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useTodo } from '../../hooks/useTodo';
import { brand, glass, gradient, ink } from '@tumbaland/components';

/**
 * Shared line box for the label, the text and the reroll button. The three have
 * different intrinsic heights, so pinning them all to one value is what keeps
 * them on the same line when the text wraps.
 */
const LINE_HEIGHT = '22px';

/**
 * Something to do together, rerollable.
 *
 * The old home page was this and nothing else; then it became a thin strip at
 * the very bottom, which is where things go to be ignored. It sits under the
 * greeting now — the first thing on the page that is not navigation, and the
 * only part with any warmth to it. Still small: it is a nudge, not a feature,
 * and the modules below are what people actually came for.
 */
export function DailyTodo() {
  const { todo, isLoading, error, fetchTodo } = useTodo();

  return (
    <Box
      sx={{
        ...glass,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: 2.25,
        py: 1.75,
        // Rounded rectangle rather than a pill: the text wraps to two or three
        // lines for longer entries, and a 999px radius looks broken once it does.
        borderRadius: 3,
        // A hairline of the brand gradient down the leading edge. Enough to mark
        // the card as the page's one warm thing without tinting the whole card,
        // which would fight the module cards below for attention.
        '&::before': {
          content: '""',
          position: 'absolute',
          insetBlock: 0,
          insetInlineStart: 0,
          width: 3,
          background: gradient.brand
        }
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: brand.magenta,
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
          color: error ? '#ef4444' : ink.body,
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
        sx={{ color: brand.pink, flexShrink: 0, mt: '-4px', mr: '-4px' }}
      >
        <AutorenewIcon sx={{ fontSize: 19 }} />
      </IconButton>
    </Box>
  );
}

export default DailyTodo;
