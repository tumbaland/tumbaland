import { useCallback } from 'react';
import { Box } from '@mui/material';
import { authService } from '../services/authService';
import BgImageBox from '../components/BgImageBox';
import { HeroSection } from '../components/landing/HeroSection';
import { ProductsSection } from '../components/landing/ProductsSection';
import { ProductPreview } from '../components/landing/ProductPreview';
import { PrivacySection } from '../components/landing/PrivacySection';
import { PricingTable } from '../components/landing/PricingTable';
import { FaqSection } from '../components/landing/FaqSection';
import { LandingFooter } from '../components/landing/LandingFooter';

/**
 * The public front page, shown at `/` to signed-out visitors. Signed-in users
 * get the dashboard instead (see routes/AppRoutes.tsx).
 *
 * Every plan choice routes to sign-in rather than to checkout: there is no
 * subscription to create until there is an account to attach it to, and
 * payment-front's PlansPage is the real checkout surface.
 */
export function LandingPage() {
  const handleSignIn = useCallback(() => {
    authService.redirectToLogin();
  }, []);

  const handleSeePricing = useCallback(() => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <HeroSection onSignIn={handleSignIn} onSeePricing={handleSeePricing} />
        <ProductsSection />
        {/* Sits below the pillars deliberately: the visual lands better once the
            reader knows what the four modules are than it does interrupting the
            hero before they understand the product. */}
        <Box sx={{ px: 2, pb: { xs: 6, md: 8 } }}>
          <ProductPreview />
        </Box>
        <PrivacySection />
        <PricingTable onChoosePlan={handleChoosePlan} />
        <FaqSection />
        <LandingFooter onSignIn={handleSignIn} />
      </Box>
    </Box>
  );
}

export default LandingPage;
