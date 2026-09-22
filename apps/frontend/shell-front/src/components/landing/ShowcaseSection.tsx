import { Box, Typography } from '@mui/material';
import { ink, moduleAccent } from '@tumbaland/frontend-core';
import { SectionHeading } from './SectionHeading';
import { PhoneFrame } from './PhoneFrame';
import { JournalScreen, ChatScreen, AlbumScreen } from './MockScreens';
import { CHAT_APP } from '../../config/apps';
import { useInView } from './useInView';

/**
 * Where everything it writes ends up: three screens of the app, animating
 * once as they come into view.
 *
 * This replaced four cards that each carried a headline and a sentence. The
 * sentences said what a journal, an album and a chat are, which nobody
 * needed telling; the screens say what this one looks like, which is the only
 * part a visitor cannot guess.
 *
 * On a phone the three sit in a row you swipe, each wide enough to read. Three
 * shrunk to a third of a 360px screen is three thumbnails of nothing.
 */

/** Chat in the middle, standing forward: it is where the rest starts. */
const SCREENS = [
  { key: 'journal', name: 'Journal', caption: 'Where your time went', color: moduleAccent.journal, Screen: JournalScreen },
  { key: 'chat', name: 'Chat', caption: 'Photos file themselves', color: CHAT_APP.color, Screen: ChatScreen },
  { key: 'album', name: 'Album', caption: 'Photos you can find', color: moduleAccent.album, Screen: AlbumScreen }
] as const;

export function ShowcaseSection() {
  // One observer for the section, so the three screens play together rather
  // than each starting as it crosses the line on its own.
  const [ref, playing] = useInView(0.15);

  return (
    <Box
      component="section"
      id="modules"
      ref={ref}
      sx={{ maxWidth: 1120, mx: 'auto', px: 2, py: { xs: 4, md: 7 }, scrollMarginTop: 72 }}
    >
      <SectionHeading eyebrow="What is in it" title="And here is where it lands" />

      <Box
        sx={{
          display: 'grid',
          gridAutoFlow: { xs: 'column', md: 'row' },
          gridAutoColumns: { xs: '62%', md: 'auto' },
          gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' },
          justifyContent: { md: 'center' },
          alignItems: 'start',
          gap: { xs: 2, md: 4 },
          // Full bleed on a phone so the row looks like something to swipe,
          // with the page gutter kept as padding inside it.
          mx: { xs: -2, md: 'auto' },
          px: { xs: 2, md: 0 },
          maxWidth: { md: 880 },
          overflowX: { xs: 'auto', md: 'visible' },
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
          scrollPaddingLeft: 16,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {SCREENS.map(({ key, name, caption, color, Screen }, index) => (
          <Box key={key} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <PhoneFrame
              sx={{
                width: '100%',
                // The middle one stands a step forward, once there is a row
                // rather than a queue.
                transform: { md: index === 1 ? 'translateY(-18px)' : 'none' }
              }}
            >
              <Screen playing={playing} />
            </PhoneFrame>

            <Box sx={{ textAlign: 'center', mt: { xs: 1.25, md: index === 1 ? 0 : 1.75 } }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color }}>
                {name}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.92rem', md: '1rem' }, fontWeight: 600, color: ink.strong, mt: 0.25 }}>
                {caption}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Typography sx={{ textAlign: 'center', mt: { xs: 2.5, md: 4 }, fontSize: { xs: '0.9rem', md: '0.95rem' }, color: ink.body }}>
        Shared between the two of you, and anyone else you add to your group.
      </Typography>
      {/* Said once, plainly. The screens are the app's own layout, but the
          evenings, the messages and the holiday in them are made up. */}
      <Typography sx={{ textAlign: 'center', mt: 0.75, fontSize: 12.5, color: ink.muted }}>
        Screens shown with sample data.
      </Typography>
    </Box>
  );
}

export default ShowcaseSection;
