import { Box, Button, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brand, brandButton, ink, wordmark } from '../../theme/tokens';

interface HeroSectionProps {
  onSignIn: () => void;
  /**
   * Scrolls to the FAQ, which is where "why is it free" is actually answered —
   * deliberately not a jump to the prices, and not past the answer to the ask.
   */
  onWhyFree: () => void;
}

export function HeroSection({ onSignIn, onWhyFree }: HeroSectionProps) {
  return (
    <Box component="section" sx={{ pt: { xs: 5, md: 8 }, pb: { xs: 3, md: 4 }, px: 2 }}>
      {/* Wordmark, in the app's own script face so the landing page and the
          product behind the login look like the same thing. */}
      <Typography
        sx={{
          ...wordmark,
          textAlign: 'center',
          fontSize: { xs: 34, sm: 40, md: 46 },
          mb: { xs: 2, md: 2.5 }
        }}
      >
        Tumbaland
      </Typography>

      <Typography
        component="h1"
        sx={{
          fontSize: { xs: '1.95rem', sm: '2.5rem', md: '2.95rem' },
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.08,
          color: ink.strong,
          textAlign: 'center',
          textWrap: 'balance',
          maxWidth: 880,
          mx: 'auto',
          mb: 2.5
        }}
      >
        Photo albums, finance tracking and a journal. One private place.
      </Typography>

      <Typography
        sx={{
          fontSize: { xs: '1.02rem', md: '1.16rem' },
          lineHeight: 1.6,
          color: ink.body,
          textAlign: 'center',
          maxWidth: 620,
          mx: 'auto',
          mb: 3.5
        }}
      >
        Photos get tagged for you. Net worth stays up to date. Your journal keeps track of where
        the days went. All free.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
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
          variant="text"
          size="large"
          onClick={onWhyFree}
          sx={{
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            px: 3,
            py: 1.4,
            borderRadius: 3,
            color: brand.purple,
            '&:hover': { backgroundColor: `${brand.purple}17` }
          }}
        >
          Why it&apos;s free
        </Button>
      </Box>

      <Typography sx={{ fontSize: 13.5, color: ink.muted, textAlign: 'center' }}>
        Free · Private until you share
      </Typography>
    </Box>
  );
}

export default HeroSection;
