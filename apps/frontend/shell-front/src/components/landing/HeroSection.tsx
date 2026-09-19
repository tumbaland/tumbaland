import { Box, Button, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brand, brandButton, glass, gradient, ink } from '@tumbaland/components';

/**
 * The first screen, and the whole pitch.
 *
 * The assistant connector leads because it is the part nothing else on the
 * shelf has: you say what happened and it lands as a proper entry, and you ask
 * a question and the answer comes out of your own history. The modules follow
 * as what it can reach.
 *
 * Laid out for a phone first. On a narrow screen the claim, the button and the
 * sample exchange stack so all three fit the first screen; from `md` up they
 * sit in two columns, the claim beside its proof. The exchange is the proof:
 * "MCP server" means nothing to the person this page is for, and what they want
 * to know is what it feels like to use.
 *
 * Only Claude is named, because Claude is what has been tested end to end; the
 * standard covers the rest and can be named without naming a product.
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
        px: { xs: 1.5, md: 2 },
        py: { xs: 1, md: 1.25 },
        // Squared on the speaker's own side, the way every messaging app does
        // it: the shape alone says who is talking, so nothing needs labelling.
        borderRadius: 3,
        borderBottomRightRadius: mine ? 0.5 : 3,
        borderBottomLeftRadius: mine ? 3 : 0.5,
        background: mine ? gradient.brand : 'rgba(255,255,255,0.82)',
        border: mine ? 'none' : '1px solid rgba(255,255,255,0.9)',
        color: mine ? '#fff' : ink.body,
        fontSize: { xs: '0.86rem', md: '0.95rem' },
        lineHeight: 1.5,
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
        maxWidth: 1120,
        mx: 'auto',
        px: 2,
        pt: { xs: 2.5, md: 6 },
        pb: { xs: 3, md: 7 },
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1.05fr 0.95fr' },
        alignItems: 'center',
        gap: { xs: 3, md: 6 }
      }}
    >
      <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
        <Typography
          sx={{
            fontSize: { xs: 11, md: 12 },
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: brand.purple,
            mb: { xs: 1.25, md: 2 }
          }}
        >
          Works with Claude · and any MCP client
        </Typography>

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3.15rem' },
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.06,
            color: ink.strong,
            textWrap: 'balance',
            mb: { xs: 1.5, md: 2.5 }
          }}
        >
          Just tell your assistant. It writes it down.
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: '1rem', md: '1.18rem' },
            lineHeight: 1.55,
            color: ink.body,
            maxWidth: 520,
            mx: { xs: 'auto', md: 0 },
            mb: { xs: 2.5, md: 3.5 }
          }}
        >
          Connect Tumbaland once and your assistant can keep your journal, read your accounts and
          find your photos. Everything it writes is yours, in a real app you can open.
        </Typography>

        {/* Full width and stacked on a phone, where a thumb reaches for the
            first button; side by side once there is room. */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: { sm: 'center', md: 'flex-start' },
            gap: { xs: 1, sm: 1.5 },
            maxWidth: { xs: 400, sm: 'none' },
            mx: { xs: 'auto', md: 0 },
            mb: { xs: 1.75, md: 2.5 }
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={onSignIn}
            sx={{ ...brandButton, fontSize: '1rem', px: 3.5, py: 1.3 }}
          >
            Continue with Google
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
              py: 1.3,
              borderRadius: 3,
              color: brand.purple,
              borderColor: `${brand.purple}55`,
              '&:hover': { borderColor: brand.purple, backgroundColor: `${brand.purple}12` }
            }}
          >
            See how it connects
          </Button>
        </Box>

        <Typography sx={{ fontSize: { xs: 12.5, md: 13.5 }, color: ink.muted }}>
          Free · You pick what it can reach · Disconnect whenever
        </Typography>
      </Box>

      <Box
        sx={{
          ...glass,
          p: { xs: 1.5, md: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1, md: 1.25 },
          width: '100%',
          maxWidth: { xs: 460, md: 'none' },
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
