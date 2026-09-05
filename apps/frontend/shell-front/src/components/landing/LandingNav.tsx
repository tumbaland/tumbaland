import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Drawer, IconButton, Link, List, ListItemButton, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GoogleIcon from '@mui/icons-material/Google';
import { brand, brandButton, ink, wordmark } from '../../theme/tokens';

/**
 * The bar across the top of the public page.
 *
 * The landing page had no navigation at all: the only way to reach any of its
 * sections was to scroll past everything above them, and the only sign-in
 * button was the one in the hero — so a returning visitor who scrolled had no
 * way back to it. Both are the sort of thing a visitor reads as "unfinished"
 * without being able to say why.
 *
 * Sticky and frosted rather than fixed and opaque: the cloud backdrop shows
 * through, which is what keeps the bar part of the page instead of a strip
 * laid on top of it.
 */

interface Anchor {
  id: string;
  label: string;
}

/**
 * Where the bar can take you, in the order the page tells the story.
 *
 * Deliberately four. A public page with nine nav items is a page that has not
 * decided what it is about, and these are the four questions someone actually
 * arrives with: what does it do, what is in it, what happens to my data, what
 * does it cost.
 */
const ANCHORS: Anchor[] = [
  { id: 'assistant', label: 'Assistant' },
  { id: 'modules', label: 'What is in it' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'support', label: 'Pricing' }
];

interface LandingNavProps {
  onSignIn: () => void;
}

export function LandingNav({ onSignIn }: LandingNavProps) {
  const [open, setOpen] = useState(false);
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
   * scrolling, which is also what makes this survive the next layout change.
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

  const goTo = useCallback((id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      {/* Zero-height marker: in view means the page is at the top. */}
      <Box ref={setTop} aria-hidden sx={{ height: 0 }} data-testid="page-top" />
      <Box
        component="nav"
        aria-label="Page sections"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          // Scrolls inside Layout's own scroll container, so no fixed positioning
          // and no offset for it anywhere else on the page.
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
            maxWidth: 1200,
            mx: 'auto',
            px: { xs: 2, md: 3 },
            height: { xs: 60, md: 68 },
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Link href="/" underline="none" sx={{ ...wordmark, fontSize: { xs: 22, md: 25 }, pb: 0, flexShrink: 0 }}>
            Tumbaland
          </Link>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
            {ANCHORS.map((anchor) => (
              <Button
                key={anchor.id}
                onClick={() => goTo(anchor.id)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  px: 1.75,
                  borderRadius: 2,
                  color: ink.body,
                  '&:hover': { color: brand.purple, backgroundColor: `${brand.purple}12` }
                }}
              >
                {anchor.label}
              </Button>
            ))}
          </Box>

          <Button
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onSignIn}
            sx={{
              ...brandButton,
              display: { xs: 'none', sm: 'inline-flex' },
              px: 2.25,
              py: 0.9,
              fontSize: '0.92rem',
              flexShrink: 0
            }}
          >
            Sign in
          </Button>

          <IconButton
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            sx={{ display: { md: 'none' }, color: ink.strong }}
          >
            <MenuIcon />
          </IconButton>
        </Box>

        <Drawer
          anchor="right"
          open={open}
          onClose={() => setOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: 264,
                px: 2,
                py: 3,
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(16px)'
              }
            }
          }}
        >
          <Typography sx={{ ...wordmark, fontSize: 24, px: 1, mb: 2 }}>Tumbaland</Typography>
          <List sx={{ p: 0 }}>
            {ANCHORS.map((anchor) => (
              <ListItemButton
                key={anchor.id}
                onClick={() => goTo(anchor.id)}
                sx={{ borderRadius: 2, fontWeight: 600, color: ink.body, fontSize: '1rem' }}
              >
                {anchor.label}
              </ListItemButton>
            ))}
          </List>
          <Button
            fullWidth
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onSignIn}
            sx={{ ...brandButton, mt: 2, py: 1.15 }}
          >
            Sign in
          </Button>
        </Drawer>
      </Box>
    </>
  );
}

export default LandingNav;
