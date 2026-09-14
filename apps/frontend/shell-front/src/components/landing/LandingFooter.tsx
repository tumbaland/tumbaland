import { Box, Button, Link, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brandButton, ink, brand } from '../../theme/tokens';
import type { DocumentKey } from './DocumentDialog';

interface LandingFooterProps {
  onSignIn: () => void;
  /** Opens the guide, the privacy policy or the terms over the page. */
  onOpen: (doc: DocumentKey) => void;
}

const footerLink = {
  fontSize: 14,
  color: ink.muted,
  textDecoration: 'none',
  '&:hover': { color: brand.purple, textDecoration: 'underline' }
} as const;

/**
 * Each carries its real address, so it still works opened in a new tab or
 * shared; a plain click opens the document over the page.
 */
const LINKS: Array<{ doc: DocumentKey; href: string; label: string }> = [
  { doc: 'connect', href: '/connect', label: 'Connect an assistant' },
  { doc: 'privacy', href: '/privacy', label: 'Privacy' },
  { doc: 'terms', href: '/terms', label: 'Terms' }
];

export function LandingFooter({ onSignIn, onOpen }: LandingFooterProps) {
  return (
    <Box
      component="footer"
      sx={{ maxWidth: 1120, mx: 'auto', px: 2, pt: { xs: 2, md: 4 }, pb: { xs: 'calc(24px + env(safe-area-inset-bottom))', md: 8 } }}
    >
      <Box
        sx={{
          maxWidth: 780,
          mx: 'auto',
          textAlign: 'center',
          px: { xs: 2.25, md: 5.5 },
          py: { xs: 3, md: 5.5 },
          borderRadius: { xs: 4, md: 5 },
          background: 'linear-gradient(135deg, rgba(255,31,174,0.10), rgba(139,92,246,0.10))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.7)'
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.4rem', md: '1.95rem' },
            fontWeight: 750,
            letterSpacing: '-0.025em',
            color: ink.strong,
            textWrap: 'balance',
            mb: { xs: 1, md: 1.5 }
          }}
        >
          It&apos;s free. That&apos;s the whole offer.
        </Typography>
        <Typography sx={{ color: ink.body, fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.55, mb: { xs: 2.25, md: 3.5 } }}>
          Sign in with Google and it is all there. No setup, no card, nothing counting down.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={onSignIn}
          sx={{ ...brandButton, width: { xs: '100%', sm: 'auto' }, maxWidth: 400, fontSize: '1rem', px: 4, py: 1.3 }}
        >
          Continue with Google
        </Button>
      </Box>

      <Box
        sx={{
          maxWidth: 780,
          mx: 'auto',
          mt: { xs: 2.5, md: 4 },
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: { xs: 2, md: 2.5 },
          rowGap: 1,
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {LINKS.map((link) => (
          <Link
            key={link.doc}
            href={link.href}
            onClick={(event) => {
              event.preventDefault();
              onOpen(link.doc);
            }}
            sx={footerLink}
          >
            {link.label}
          </Link>
        ))}
        <Typography sx={{ fontSize: 14, color: ink.faint }}>© {new Date().getFullYear()} Tumbaland</Typography>
      </Box>
    </Box>
  );
}

export default LandingFooter;
