import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';
import { ink, moduleAccent } from '@tumbaland/frontend-core';
import { CHAT_APP } from '../../../config/apps';

/** One reveal, `delay` ms into the sequence. */
export const reveal = (playing: boolean, delay: number): SxProps<Theme> => ({
  opacity: playing ? 1 : 0,
  transform: playing ? 'none' : 'translateY(10px)',
  transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`
});

export const cardSx = {
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(255,255,255,0.95)',
  borderRadius: '14px',
  boxShadow: '0 10px 24px -20px rgba(31,38,135,0.7)',
  p: '11px 12px'
} as const;

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', px: '12px', pt: '18px', pb: 0 }}>
      {children}
    </Box>
  );
}

export function ScreenHeader({ title, sub, accent }: { title: string; sub: string; accent: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '7px', mb: '10px', px: '2px' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: ink.strong }}>{title}</Typography>
      <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: accent }}>{sub}</Typography>
    </Box>
  );
}

/** The app's own tab bar, in its order and its module colours. */
const TABS = [
  { key: 'home', icon: HomeIcon, label: 'Home', color: moduleAccent.home },
  { key: 'journal', icon: FavoriteIcon, label: 'Journal', color: moduleAccent.journal },
  { key: 'chat', icon: ChatBubbleIcon, label: 'Chat', color: CHAT_APP.color },
  { key: 'album', icon: PhotoAlbumIcon, label: 'Album', color: moduleAccent.album },
  { key: 'account', icon: AccountCircleIcon, label: 'Account', color: ink.body }
] as const;

/** Half of what makes a card read as a screen rather than a card. */
export function TabBar({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <Box
      sx={{
        mt: 'auto',
        mx: '-12px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        pt: '8px',
        pb: '12px',
        background: 'rgba(253,244,250,0.72)',
        backdropFilter: 'blur(16px) saturate(165%)',
        borderTop: '1px solid rgba(124,58,237,0.10)'
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const on = tab.key === active;
        const color = on ? tab.color : ink.faint;
        return (
          <Box key={tab.key} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Icon sx={{ fontSize: 15, color }} />
            <Typography sx={{ fontSize: 8, fontWeight: on ? 700 : 500, color }}>{tab.label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
