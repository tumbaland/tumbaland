import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import SendIcon from '@mui/icons-material/Send';
import { brand, ink, moduleAccent } from '@tumbaland/frontend-core';
import { CHAT_APP } from '../../../config/apps';
import { PhotoTile } from '../PhotoTile';
import { reveal, Screen, TabBar } from './shared';

const CHAT_GREEN = '#16a34a';

function Bubble({ mine, children, sx }: { mine?: boolean; children: React.ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        px: '10px',
        py: '6px',
        borderRadius: '13px',
        fontSize: 10.5,
        lineHeight: 1.4,
        color: mine ? '#fff' : ink.strong,
        background: mine ? brand.pinkInk : 'rgba(255,255,255,0.9)',
        border: mine ? 'none' : '1px solid rgba(255,255,255,0.95)',
        ...sx
      }}
    >
      {children}
    </Box>
  );
}

/**
 * A conversation, with the parts that make it this app's rather than any
 * chat's: the photo filing itself into the trip's album, who is around, and
 * a call between the two of you, logged in the thread like the app logs it.
 */
export function ChatScreen({ playing }: { playing: boolean }) {
  return (
    <Screen>
      {/* Who it is with, and that she is here now. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '10px', px: '2px' }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              background: brand.pinkInk
            }}
          >
            I
          </Box>
          <Box
            sx={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: CHAT_GREEN,
              boxShadow: '0 0 0 2px #fff'
            }}
          />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: ink.strong, lineHeight: 1.2 }}>Irja</Typography>
          <Typography sx={{ fontSize: 9.5, color: ink.muted, lineHeight: 1.2 }}>Active now</Typography>
        </Box>
        <CallOutlinedIcon sx={{ fontSize: 17, color: CHAT_APP.color }} />
      </Box>

      {/* Anchored to the bottom, as a thread is: the newest is nearest the box
          you type in, and earlier messages run up out of view. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '6px', flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
        <Typography sx={{ textAlign: 'center', fontSize: 9, color: ink.muted, my: '2px' }}>Yesterday</Typography>
        <Bubble>are you home by 7?</Bubble>
        <Bubble mine>yes, bringing sushi 🍣</Bubble>

        <Typography sx={{ textAlign: 'center', fontSize: 9, color: ink.muted, mt: '8px', mb: '2px' }}>Today</Typography>
        <Typography sx={{ textAlign: 'center', fontSize: 9, color: ink.muted, my: '2px', ...reveal(playing, 0) }}>
          Irja set photos to go to Rome
        </Typography>

        <Bubble sx={reveal(playing, 150)}>look where we ended up</Bubble>

        <Box sx={{ alignSelf: 'flex-start', width: '70%', ...reveal(playing, 300) }}>
          <PhotoTile scene="city" radius={13} sx={{ width: '100%', height: 116 }} />
          {/* The photo is already in the trip's album; nobody had to put it there. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', mt: '3px', ml: '4px' }}>
            <PhotoAlbumIcon sx={{ fontSize: 10, color: moduleAccent.album }} />
            <Typography sx={{ fontSize: 9, fontWeight: 600, color: moduleAccent.album }}>In Rome</Typography>
          </Box>
        </Box>

        <Bubble mine sx={reveal(playing, 500)}>
          that one is going on our wall
        </Bubble>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', my: '4px', ...reveal(playing, 750) }}>
          <CallOutlinedIcon sx={{ fontSize: 10, color: ink.muted }} />
          <Typography sx={{ fontSize: 9, color: ink.muted }}>Call, 14 min · 21:40</Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', ml: '4px', mt: '2px', ...reveal(playing, 950) }}>
          <Box sx={{ display: 'flex', gap: '3px' }}>
            {[0, 1, 2].map((dot) => (
              <Box key={dot} sx={{ width: 4, height: 4, borderRadius: '50%', background: ink.muted, opacity: 0.4 + dot * 0.25 }} />
            ))}
          </Box>
          <Typography sx={{ fontSize: 9, color: ink.muted }}>Irja is typing</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', mt: '10px', mb: '8px' }}>
        <Box
          sx={{
            flexGrow: 1,
            px: '10px',
            py: '6px',
            borderRadius: '999px',
            fontSize: 10,
            color: ink.faint,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(15,23,42,0.06)'
          }}
        >
          Message
        </Box>
        <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: brand.pinkInk }}>
          <SendIcon sx={{ fontSize: 12, color: '#fff' }} />
        </Box>
      </Box>

      <TabBar active="chat" />
    </Screen>
  );
}
