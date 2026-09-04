import { Box, Link, Typography } from '@mui/material';
import { SectionHeading } from './SectionHeading';
import { brand, glass, gradient, ink } from '../../theme/tokens';

/**
 * Talking to it.
 *
 * The feature had no presence on this page at all — it was reachable only from
 * a footer link, which meant the one thing that most distinguishes Tumbaland
 * from a notes app was invisible to everyone deciding whether to sign up.
 *
 * Shown as a conversation rather than described, because "MCP server" and
 * "connector" mean nothing to the person this page is for, and what they
 * actually want to know is what it feels like to use.
 */

/** One turn of the sample exchange. `mine` is the person, not the assistant. */
interface Line {
  mine: boolean;
  text: string;
}

const EXCHANGE: Line[] = [
  { mine: true, text: 'we went to Kolm Sõsarat on Saturday, and watched two Futurama episodes' },
  { mine: false, text: 'Logged for Saturday 5 September. Dining at Kolm Sõsarat, and Movies.' },
  { mine: true, text: 'when did we last see a film together?' },
  { mine: false, text: 'Two weeks ago, on 22 August. Before that, four times in July.' }
];

function Bubble({ mine, text }: Line) {
  return (
    <Box
      sx={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: { xs: '92%', sm: '80%' },
        px: 2,
        py: 1.25,
        // Squared on the speaker's own side, the way every messaging app does
        // it — the shape alone says who is talking, so nothing needs labelling.
        borderRadius: 3,
        borderBottomRightRadius: mine ? 0.5 : 3,
        borderBottomLeftRadius: mine ? 3 : 0.5,
        background: mine ? gradient.brand : 'rgba(255,255,255,0.78)',
        border: mine ? 'none' : '1px solid rgba(255,255,255,0.85)',
        color: mine ? '#fff' : ink.body,
        fontSize: { xs: '0.92rem', md: '0.97rem' },
        lineHeight: 1.55,
        boxShadow: mine ? `0 8px 22px -14px ${brand.magenta}` : 'none'
      }}
    >
      {text}
    </Box>
  );
}

export function AssistantSection() {
  return (
    <Box component="section" sx={{ px: 2, py: { xs: 5, md: 7 } }}>
      <SectionHeading
        eyebrow="Assistants"
        title="Or just tell it what happened"
        subtitle="Connect Claude, ChatGPT or Gemini. Write your journal by talking to it, and ask what you did last month."
      />

      <Box
        sx={{
          ...glass,
          maxWidth: 640,
          mx: 'auto',
          p: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25
        }}
        // Decorative: the real explanation is the heading above and the link
        // below, and a screen reader gains nothing from a staged conversation.
        aria-hidden
      >
        {EXCHANGE.map((line) => (
          <Bubble key={line.text} {...line} />
        ))}
      </Box>

      <Typography
        sx={{
          textAlign: 'center',
          mt: 3,
          fontSize: '0.95rem',
          color: ink.muted,
          maxWidth: 560,
          mx: 'auto'
        }}
      >
        You pick what it can reach. Disconnect it whenever you like.{' '}
        <Link href="/connect" sx={{ color: brand.purple, fontWeight: 600 }}>
          How connecting works
        </Link>
      </Typography>
    </Box>
  );
}

export default AssistantSection;
