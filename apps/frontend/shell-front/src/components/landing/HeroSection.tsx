import { Box, Button, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { brand, brandButton, ink } from '@tumbaland/frontend-core';
import { PhoneFrame } from './PhoneFrame';
import { ChatScreen } from './MockScreens';
import { useInView } from './useInView';

/**
 * The first screen, and the whole pitch.
 *
 * It leads with what the app is for: one private place for two people to talk,
 * keep their photos and remember what they did. Chat is where that starts, so
 * the right half is the chat, playing as it comes into view: a photo arrives
 * and files itself into the trip's album, a reply, a call between the two of
 * them. The rest of the page follows from that one screen.
 *
 * The assistant connector used to lead. It is still on the page, further down,
 * as something you can add, not as the reason to sign up.
 *
 * Laid out for a phone first. On a narrow screen the claim, the buttons and
 * the phone stack in that order; from `md` up they sit in two columns, the
 * claim beside its proof.
 */

interface HeroSectionProps {
  onSignIn: () => void;
  /** Scrolls to the screens of the app, one section down. */
  onSeeInside: () => void;
}

export function HeroSection({ onSignIn, onSeeInside }: HeroSectionProps) {
  const [phoneRef, playing] = useInView(0.3);

  return (
    <Box
      component="section"
      sx={{
        maxWidth: 1120,
        mx: 'auto',
        px: 2,
        pt: { xs: 2.5, md: 6 },
        pb: { xs: 3, md: 7 },
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1.05fr 0.95fr' },
        alignItems: 'center',
        gap: { xs: 3, md: 6 }
      }}
    >
      <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3.15rem' },
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.06,
            color: ink.strong,
            textWrap: 'balance',
            mb: { xs: 1.5, md: 2.5 }
          }}
        >
          A private app for the two of you.
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: '1rem', md: '1.18rem' },
            lineHeight: 1.55,
            color: ink.body,
            maxWidth: 480,
            mx: { xs: 'auto', md: 0 },
            mb: { xs: 2.5, md: 3.5 }
          }}
        >
          Chat and call each other. Photos you send in chat go straight into your shared album, and there is a journal for the things you do together.
        </Typography>

        {/* Full width and stacked on a phone, where a thumb reaches for the
            first button; side by side once there is room. */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: { sm: 'center', md: 'flex-start' },
            gap: { xs: 1, sm: 1.5 },
            maxWidth: { xs: 400, sm: 'none' },
            mx: { xs: 'auto', md: 0 },
            mb: { xs: 1.75, md: 2.5 }
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={onSignIn}
            sx={{ ...brandButton, fontSize: '1rem', px: 3.5, py: 1.3 }}
          >
            Continue with Google
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={onSeeInside}
            sx={{
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              px: 3,
              py: 1.3,
              borderRadius: 3,
              color: brand.purple,
              borderColor: `${brand.purple}55`,
              '&:hover': { borderColor: brand.purple, backgroundColor: `${brand.purple}12` }
            }}
          >
            See how it looks
          </Button>
        </Box>

        <Typography sx={{ fontSize: { xs: 12.5, md: 13.5 }, color: ink.muted }}>
          Free. Only the people you invite can see it.
        </Typography>
      </Box>

      <Box ref={phoneRef} data-testid="hero-chat" sx={{ width: '100%', maxWidth: { xs: 244, md: 270 }, mx: 'auto' }}>
        <PhoneFrame sx={{ width: '100%' }}>
          <ChatScreen playing={playing} />
        </PhoneFrame>
      </Box>
    </Box>
  );
}

export default HeroSection;
