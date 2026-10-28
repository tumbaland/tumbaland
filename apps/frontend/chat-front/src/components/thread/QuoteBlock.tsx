import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { surface } from '@tumbaland/frontend-core';
import { chatColors } from './themes';

/** What a reply shows above its own content. */
export interface QuoteView {
  /** "You", the other person, or empty when it is not known. */
  name: string;
  text: string;
  unsent: boolean;
  /** Scrolls to the original. Absent where it cannot be found. */
  onOpen?: () => void;
}

/**
 * The message a reply answers, at the top of its bubble. A tap goes to it.
 */
export function QuoteBlock({ quote, mine }: { quote: QuoteView; mine: boolean }) {
  const text = quote.unsent ? 'Message unsent' : quote.text;
  const clickable = Boolean(quote.onOpen);
  return (
    <Box
      component={clickable ? 'button' : 'div'}
      type={clickable ? 'button' : undefined}
      onClick={quote.onOpen}
      aria-label={clickable ? `Reply to ${quote.name || 'a message'}: ${text}. Show it` : undefined}
      sx={{
        display: 'block',
        width: '100%',
        minWidth: 120,
        mb: 0.75,
        px: 1,
        py: 0.5,
        border: 'none',
        borderLeft: `3px solid ${mine ? 'rgba(255,255,255,0.85)' : chatColors.bubble}`,
        borderRadius: 1.5,
        bgcolor: mine ? 'rgba(255,255,255,0.16)' : surface.sunken,
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: clickable ? 'pointer' : 'default'
      }}
    >
      {quote.name && (
        <Typography variant="caption" component="span" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.3 }}>
          {quote.name}
        </Typography>
      )}
      <Typography
        variant="caption"
        component="span"
        sx={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.35,
          opacity: 0.85,
          fontStyle: quote.unsent ? 'italic' : 'normal',
          whiteSpace: 'pre-wrap'
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
