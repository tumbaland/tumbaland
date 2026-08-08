import { Box, Button, Link, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import GoogleIcon from '@mui/icons-material/Google';

interface LandingFooterProps {
  onSignIn: () => void;
}

export function LandingFooter({ onSignIn }: LandingFooterProps) {
  return (
    <Box component="footer" sx={{ px: 2, pb: { xs: 6, md: 8 } }}>
      <Box
        sx={{
          maxWidth: 780,
          mx: 'auto',
          textAlign: 'center',
          p: { xs: 4, md: 5.5 },
          borderRadius: 5,
          background: 'linear-gradient(135deg, rgba(255,31,174,0.10), rgba(139,92,246,0.10))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.7)'
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.55rem', md: '1.95rem' },
            fontWeight: 750,
            letterSpacing: '-0.025em',
            color: '#0f172a',
            textWrap: 'balance',
            mb: 1.5
          }}
        >
          Start with the free tier. Decide later.
        </Typography>
        <Typography sx={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6, mb: 3.5 }}>
          Sign in with Google and everything is there immediately — no setup, no card, and no
          countdown running in the background.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={onSignIn}
          sx={{
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            px: 4,
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
      </Box>

      <Box
        sx={{
          maxWidth: 780,
          mx: 'auto',
          mt: 4,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Link
          href="https://github.com/toomastahves/tumbaland"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.6,
            fontSize: 14,
            color: '#64748b',
            textDecoration: 'none',
            '&:hover': { color: '#9333ea', textDecoration: 'underline' }
          }}
        >
          <GitHubIcon sx={{ fontSize: 16 }} />
          Source
        </Link>
        <Link
          href="/payments/terms"
          sx={{
            fontSize: 14,
            color: '#64748b',
            textDecoration: 'none',
            '&:hover': { color: '#9333ea', textDecoration: 'underline' }
          }}
        >
          Terms
        </Link>
        <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>
          © {new Date().getFullYear()} Tumbaland
        </Typography>
      </Box>
    </Box>
  );
}

export default LandingFooter;
