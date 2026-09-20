import { Box, Button, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brand, brandButton, ink } from '@tumbaland/frontend-core';
import { ChatPlayback } from './ChatPlayback';

/**
 * The first screen, and the whole pitch.
 *
 * The assistant connector leads because it is the part nothing else on the
 * shelf has: you say what happened and it lands as a proper entry, and you ask
 * a question and the answer comes out of your own history.
 *
 * The right half is not an illustration of that, it is a recording of it: the
 * exchange plays out in a phone, tool calls and all. It used to be four
 * bubbles sitting there already answered, which showed the words but not the
 * one thing worth showing, that something really happens when you send it.
 *
 * Laid out for a phone first. On a narrow screen the claim, the buttons and
 * the phone stack in that order; from `md` up they sit in two columns, the
 * claim beside its proof.
 *
 * Only Claude is named, because Claude is what has been tested end to end; the
 * standard covers the rest and can be named without naming a product.
 */

interface HeroSectionProps {
  onSignIn: () => void;
  /** Scrolls to the connector address and setup, one section down. */
  onSeeHow: () => void;
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
            maxWidth: 480,
            mx: { xs: 'auto', md: 0 },
            mb: { xs: 2.5, md: 3.5 }
          }}
        >
          Connect it once. Then it keeps your journal, reads your accounts and finds your photos.
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

      <ChatPlayback testId="hero-exchange" sx={{ width: '100%', maxWidth: { xs: 244, md: 270 }, mx: 'auto' }} />
    </Box>
  );
}

export default HeroSection;
