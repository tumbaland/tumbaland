import { useCallback } from 'react';
import { Box } from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { authService } from '../services/authService';
import BgImageBox from '../components/BgImageBox';
import { LandingNav } from '../components/landing/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { AssistantSection } from '../components/landing/AssistantSection';
import { ProductsSection } from '../components/landing/ProductsSection';
import { PrivacySection } from '../components/landing/PrivacySection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { DocumentDialog, DocumentKey, isDocumentKey } from '../components/landing/DocumentDialog';

/** The query parameter naming the document open over the page, as in `/?read=privacy`. */
export const READ_PARAM = 'read';

/**
 * The public front page, shown at `/` to signed-out visitors. Signed-in users
 * get the dashboard instead (see routes/AppRoutes.tsx).
 *
 * **Phone first.** tumbaland.eu is mostly opened on a phone, so every section is
 * laid out for a narrow screen and widens from there. It is one page for every
 * screen rather than a mobile and a desktop version: the content is the same,
 * only the arrangement changes, and two copies would drift apart.
 *
 * **The assistant leads.** The connector is the part nothing else on the shelf
 * has, so it is the hero and the section under it. The modules follow as what
 * the assistant can reach.
 *
 * **Nothing to buy.** Tumbaland is free, so there is no pricing, plan table or
 * FAQ about limits and supporting.
 *
 * **Documents open over the page.** The setup guide, the privacy policy and the
 * terms open in a dialog instead of sending the reader away. The open one is
 * kept in the URL, so a phone's back button closes it and a link can point
 * straight at it.
 */
export function LandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const reading = searchParams.get(READ_PARAM);
  const openDoc = isDocumentKey(reading) ? reading : null;

  const handleSignIn = useCallback(() => {
    authService.redirectToLogin();
  }, []);

  const handleSeeHow = useCallback(() => {
    document.getElementById('assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openDocument = useCallback(
    (doc: DocumentKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(READ_PARAM, doc);
          return next;
        },
        { state: { openedHere: true } }
      );
    },
    [setSearchParams]
  );

  const closeDocument = useCallback(() => {
    // Opened from this page: step back, so the close button and a phone's back
    // button leave history the same. Arrived on a shared link instead: there
    // is nothing of ours to step back to, so drop the parameter in place.
    if ((location.state as { openedHere?: boolean } | null)?.openedHere) {
      navigate(-1);
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(READ_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [location.state, navigate, setSearchParams]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        // Take natural height inside Layout's `align-items: stretch` flex row so
        // the page scrolls in Layout's own scroll container, not a nested one.
        alignSelf: 'flex-start',
        fontFamily: '"Inter", "Roboto", sans-serif'
      }}
    >
      {/* Cloud backdrop, matching the signed-in home. Constrained to the top of
          the page and left to fade out via BgImageBox's own mask: stretching a
          landscape image over the full page height would smear it. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: { xs: 620, md: 1080 },
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <BgImageBox />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <LandingNav onSignIn={handleSignIn} />
        <HeroSection onSignIn={handleSignIn} onSeeHow={handleSeeHow} />
        {/* Straight after the hero, because the hero makes a claim that only
            holds if connecting is genuinely this small a job. */}
        <AssistantSection onOpenGuide={() => openDocument('connect')} />
        <ProductsSection />
        <PrivacySection onOpen={openDocument} />
        <LandingFooter onSignIn={handleSignIn} onOpen={openDocument} />
      </Box>

      <DocumentDialog doc={openDoc} onClose={closeDocument} />
    </Box>
  );
}

export default LandingPage;
