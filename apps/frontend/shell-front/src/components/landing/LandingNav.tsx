import { useEffect, useState } from 'react';
import { Box, Button, Link } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brandButton, wordmark } from '@tumbaland/frontend-core';

/**
 * The bar across the top of the public page: the name, and a way to sign in
 * from wherever the reader has scrolled to.
 *
 * It used to carry four section links and, on phones, a menu drawer holding
 * them. With the page down to a few short sections, the menu was a tap to reach
 * what a flick of the thumb already shows, and on the narrowest phones it hid
 * the one button that matters there. Sign-in is now on the bar at every width.
 *
 * Sticky and frosted rather than fixed and opaque: the cloud backdrop shows
 * through, which is what keeps the bar part of the page instead of a strip laid
 * on top of it.
 */

interface LandingNavProps {
  onSignIn: () => void;
}

export function LandingNav({ onSignIn }: LandingNavProps) {
  const [lifted, setLifted] = useState(false);
  const [top, setTop] = useState<HTMLDivElement | null>(null);

  /**
   * The bar is transparent over the hero and gains its own surface once the
   * page moves under it. Without that it stays clear over the scrolled content
   * and the two overlap into something unreadable.
   *
   * Watched with an observer on a marker at the very top of the page rather
   * than by listening for scroll. The landing page does not scroll the window:
   * it scrolls inside the shell Layout's own container, so `window.scrollY` is
   * zero however far down the page you are, and a scroll listener never fires
   * at all. An observer against the viewport is true whatever is doing the
   * scrolling.
   */
  useEffect(() => {
    if (!top || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (records) => setLifted(records.some((record) => !record.isIntersecting)),
      { threshold: 0 }
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [top]);

  return (
    <>
      {/* Zero-height marker: in view means the page is at the top. */}
      <Box ref={setTop} aria-hidden sx={{ height: 0 }} data-testid="page-top" />
      <Box
        component="nav"
        aria-label="Site"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          transition: 'background .25s ease, box-shadow .25s ease, border-color .25s ease',
          background: lifted ? 'rgba(255,255,255,0.72)' : 'transparent',
          backdropFilter: lifted ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: lifted ? 'blur(14px)' : 'none',
          borderBottom: '1px solid',
          borderColor: lifted ? 'rgba(255,255,255,0.8)' : 'transparent',
          boxShadow: lifted ? '0 10px 30px -28px rgba(31,38,135,0.9)' : 'none'
        }}
      >
        <Box
          sx={{
            maxWidth: 1120,
            mx: 'auto',
            px: { xs: 2, md: 3 },
            height: { xs: 56, md: 68 },
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Link href="/" underline="none" sx={{ ...wordmark, fontSize: { xs: 22, md: 25 }, pb: 0, flexShrink: 0 }}>
            Tumbaland
          </Link>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onSignIn}
            sx={{
              ...brandButton,
              px: { xs: 1.75, md: 2.25 },
              py: { xs: 0.6, md: 0.9 },
              fontSize: { xs: '0.88rem', md: '0.92rem' },
              flexShrink: 0
            }}
          >
            Sign in
          </Button>
        </Box>
      </Box>
    </>
  );
}

export default LandingNav;
