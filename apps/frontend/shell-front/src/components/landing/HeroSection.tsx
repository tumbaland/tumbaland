import { Box, Button, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';

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
          textAlign: 'center',
          fontFamily: '"Pacifico", cursive',
          fontSize: { xs: 34, sm: 40, md: 46 },
          lineHeight: 1.25,
          letterSpacing: 1,
          background: 'linear-gradient(135deg, #ff1fae 0%, #8b5cf6 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
          pb: 1,
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
          color: '#0f172a',
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
          color: '#475569',
          textAlign: 'center',
          maxWidth: 620,
          mx: 'auto',
          mb: 3.5
        }}
      >
        Albums that tag themselves. Net worth that updates itself. A journal that remembers where
        your days went. Free to use, for as long as you like.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={onSignIn}
          sx={{
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            px: 3.5,
            py: 1.4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ff1fae 0%, #8b5cf6 100%)',
            boxShadow: '0 10px 28px -10px rgba(168,45,190,0.75)',
            '&:hover': {
              background: 'linear-gradient(135deg, #f01aa2 0%, #7c4de8 100%)',
              boxShadow: '0 12px 32px -10px rgba(168,45,190,0.9)'
            }
          }}
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
            color: '#9333ea',
            '&:hover': { backgroundColor: 'rgba(147,51,234,0.09)' }
          }}
        >
          Why it&apos;s free
        </Button>
      </Box>

      <Typography sx={{ fontSize: 13.5, color: '#64748b', textAlign: 'center' }}>
        Free · Private until you share
      </Typography>
    </Box>
  );
}

export default HeroSection;
