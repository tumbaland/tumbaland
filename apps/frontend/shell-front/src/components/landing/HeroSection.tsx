import { Box, Button, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brand, brandButton, glass, gradient, ink } from '../../theme/tokens';

/**
 * The first screen, and the whole pitch.
 *
 * It used to lead with "photo albums, finance tracking and a journal" — three
 * things a visitor can already get separately, and a claim that puts Tumbaland
 * next to four products it cannot out-feature. The assistant connector is the
 * part nothing else on that list has: you say what happened and it lands as a
 * proper entry, and you ask a question and the answer comes out of your own
 * history. That now leads, and the modules follow as what it can reach.
 *
 * Two columns from `md` up, because the claim and the proof belong on screen at
 * the same time. The sample exchange is the proof: "MCP server" and "connector"
 * mean nothing to the person this page is for, and what they want to know is
 * what it feels like to use.
 *
 * Only Claude is named. The page used to promise ChatGPT and Gemini too, on the
 * reasoning that both support MCP connectors — which is true of the protocol
 * and was never true of anything anyone here had actually run. Claude is what
 * has been tested end to end, so Claude is what is claimed; the standard is
 * what covers the rest, and it can be named honestly without naming a product.
 */

interface HeroSectionProps {
  onSignIn: () => void;
  /** Scrolls to the connector address and setup, one section down. */
  onSeeHow: () => void;
}

/** One turn of the sample exchange. `mine` is the person, not the assistant. */
interface Line {
  mine: boolean;
  text: string;
}

const EXCHANGE: Line[] = [
  { mine: true, text: 'we went to Sushi House on Friday, and watched two Futurama episodes' },
  { mine: false, text: 'Logged for Friday 4 September. Dining at Sushi House, and Movies.' },
  { mine: true, text: 'how much did we spend on restaurants this year?' },
  { mine: false, text: '1,930 so far, against 1,871 last year. Slightly up, and steady month to month.' }
];

function Bubble({ mine, text }: Line) {
  return (
    <Box
      sx={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        px: 2,
        py: 1.25,
        // Squared on the speaker's own side, the way every messaging app does
        // it — the shape alone says who is talking, so nothing needs labelling.
        borderRadius: 3,
        borderBottomRightRadius: mine ? 0.5 : 3,
        borderBottomLeftRadius: mine ? 3 : 0.5,
        background: mine ? gradient.brand : 'rgba(255,255,255,0.82)',
        border: mine ? 'none' : '1px solid rgba(255,255,255,0.9)',
        color: mine ? '#fff' : ink.body,
        fontSize: { xs: '0.9rem', md: '0.95rem' },
        lineHeight: 1.55,
        boxShadow: mine ? `0 8px 22px -14px ${brand.magenta}` : 'none'
      }}
    >
      {text}
    </Box>
  );
}

export function HeroSection({ onSignIn, onSeeHow }: HeroSectionProps) {
  return (
    <Box
      component="section"
      sx={{
        pt: { xs: 3, md: 5 },
        pb: { xs: 4, md: 6 },
        px: 2,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
        alignItems: 'center',
        gap: { xs: 4, md: 6 }
      }}
    >
      <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: brand.purple,
            mb: 2
          }}
        >
          Works with Claude · and any MCP client
        </Typography>

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '2.1rem', sm: '2.6rem', md: '3.15rem' },
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.06,
            color: ink.strong,
            textWrap: 'balance',
            mb: 2.5
          }}
        >
          Just tell your assistant. It writes it down.
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: '1.05rem', md: '1.18rem' },
            lineHeight: 1.6,
            color: ink.body,
            maxWidth: 520,
            mx: { xs: 'auto', md: 0 },
            mb: 3.5
          }}
        >
          Connect Tumbaland once and your assistant can keep your journal, read your accounts and
          find your photos. Everything it writes is yours, in a real app you can open.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            justifyContent: { xs: 'center', md: 'flex-start' },
            mb: 2.5
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={onSignIn}
            sx={{ ...brandButton, fontSize: '1rem', px: 3.5, py: 1.4 }}
          >
            Start free with Google
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={onSeeHow}
            sx={{
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              px: 3,
              py: 1.4,
              borderRadius: 3,
              color: brand.purple,
              borderColor: `${brand.purple}55`,
              '&:hover': { borderColor: brand.purple, backgroundColor: `${brand.purple}12` }
            }}
          >
            See how it connects
          </Button>
        </Box>

        <Typography sx={{ fontSize: 13.5, color: ink.muted }}>
          Free · You pick what it can reach · Disconnect whenever
        </Typography>
      </Box>

      <Box
        sx={{
          ...glass,
          p: { xs: 2, md: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          width: '100%',
          maxWidth: { xs: 520, md: 'none' },
          mx: 'auto'
        }}
        // Decorative: the heading beside it is the real explanation, and a
        // screen reader gains nothing from a staged conversation.
        aria-hidden
        data-testid="hero-exchange"
      >
        {EXCHANGE.map((line) => (
          <Bubble key={line.text} {...line} />
        ))}
      </Box>
    </Box>
  );
}

export default HeroSection;
