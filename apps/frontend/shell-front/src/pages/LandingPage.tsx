import { useCallback } from 'react';
import { Box } from '@mui/material';
import { authService } from '../services/authService';
import BgImageBox from '../components/BgImageBox';
import { HeroSection } from '../components/landing/HeroSection';
import { ProductsSection } from '../components/landing/ProductsSection';
import { ProductPreview } from '../components/landing/ProductPreview';
import { AssistantSection } from '../components/landing/AssistantSection';
import { PrivacySection } from '../components/landing/PrivacySection';
import { SupportSection } from '../components/landing/SupportSection';
import { FaqSection } from '../components/landing/FaqSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { usePlans } from '../hooks/usePlans';

/**
 * The public front page, shown at `/` to signed-out visitors. Signed-in users
 * get the dashboard instead (see routes/AppRoutes.tsx).
 *
 * **The money lives at the bottom.** The price table used to sit in the middle
 * of the page, which made the pitch "here is a product, and here is what it
 * costs" when the actual offer is "here is a product, it is free, and you can
 * chip in if you want it to stay running". Support now comes after the FAQ has
 * explained why limits exist at all, so a visitor meets the ask having already
 * been told they do not have to answer it.
 *
 * Every plan choice routes to sign-in rather than to checkout: there is no
 * subscription to create until there is an account to attach it to, and
 * payment-front's PlansPage is the real checkout surface.
 */
export function LandingPage() {
  // Fetched once here rather than inside each section: the support cards and
  // the free-tier answer in the FAQ quote the same limits, and they must be the
  // same limits — the ones the services enforce.
  const plansState = usePlans();

  const handleSignIn = useCallback(() => {
    authService.redirectToLogin();
  }, []);

  const handleWhyFree = useCallback(() => {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleChoosePlan = useCallback(() => {
    authService.redirectToLogin();
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        // No SideMenu offset needed: Layout hides it for signed-out visitors,
        // who are the only ones who ever see this page.
        // Take natural height inside Layout's `align-items: stretch` flex row so
        // the page scrolls in Layout's own scroll container, not a nested one.
        alignSelf: 'flex-start',
        fontFamily: '"Inter", "Roboto", sans-serif'
      }}
    >
      {/* Cloud backdrop, matching the signed-in home. Constrained to the top of
          the page and left to fade out via BgImageBox's own mask — stretching a
          landscape image over the full page height would smear it. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: { xs: 720, md: 1080 },
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <BgImageBox />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 1200, mx: 'auto', pb: 2 }}>
        <HeroSection onSignIn={handleSignIn} onWhyFree={handleWhyFree} />
        <ProductsSection />
        {/* Sits below the pillars deliberately: the visual lands better once the
            reader knows what the four modules are than it does interrupting the
            hero before they understand the product. */}
        <Box sx={{ px: 2, pb: { xs: 6, md: 8 } }}>
          <ProductPreview />
        </Box>
        {/* After the product, before the privacy promise: it only means anything
            once you know what there is to write into, and it raises the question
            the privacy section then answers. */}
        <AssistantSection />
        <PrivacySection />
        <FaqSection plans={plansState.plans} />
        <SupportSection onChoosePlan={handleChoosePlan} {...plansState} />
        <LandingFooter onSignIn={handleSignIn} />
      </Box>
    </Box>
  );
}

export default LandingPage;
