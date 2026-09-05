import { useCallback } from 'react';
import { Box } from '@mui/material';
import { authService } from '../services/authService';
import BgImageBox from '../components/BgImageBox';
import { LandingNav } from '../components/landing/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { AssistantSection } from '../components/landing/AssistantSection';
import { ProductsSection } from '../components/landing/ProductsSection';
import { ProductPreview } from '../components/landing/ProductPreview';
import { PrivacySection } from '../components/landing/PrivacySection';
import { SupportSection } from '../components/landing/SupportSection';
import { FaqSection } from '../components/landing/FaqSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { usePlans } from '../hooks/usePlans';

/**
 * The public front page, shown at `/` to signed-out visitors. Signed-in users
 * get the dashboard instead (see routes/AppRoutes.tsx).
 *
 * **The assistant leads.** The page used to open with "photo albums, finance
 * tracking and a journal" — three things a visitor can already get separately,
 * and a claim that puts Tumbaland beside four products it cannot out-feature.
 * The connector is the part none of them have, and it is finished and working,
 * so it is now the hero and the section under it. The modules follow as what
 * the assistant can reach, which is a better argument for them than the one
 * they were making on their own.
 *
 * **The money still lives at the bottom.** Support comes after the FAQ has
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

  const handleSeeHow = useCallback(() => {
    document.getElementById('assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <LandingNav onSignIn={handleSignIn} />

        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 2 }}>
          <HeroSection onSignIn={handleSignIn} onSeeHow={handleSeeHow} />
          {/* Straight after the hero, because the hero makes a claim that only
              holds if connecting is genuinely this small a job. */}
          <AssistantSection />
          <ProductsSection />
          {/* Sits below the pillars deliberately: the visual lands better once
              the reader knows what the four modules are than it does
              interrupting the hero before they understand the product. */}
          <Box sx={{ px: 2, pb: { xs: 6, md: 8 } }}>
            <ProductPreview />
          </Box>
          <PrivacySection />
          <FaqSection plans={plansState.plans} />
          <SupportSection onChoosePlan={handleChoosePlan} {...plansState} />
          <LandingFooter onSignIn={handleSignIn} />
        </Box>
      </Box>
    </Box>
  );
}

export default LandingPage;
