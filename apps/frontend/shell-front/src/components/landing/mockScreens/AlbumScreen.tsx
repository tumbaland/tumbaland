import { Box, Typography } from '@mui/material';
import { ink, moduleAccent } from '@tumbaland/frontend-core';
import { PhotoTile } from '../PhotoTile';
import { reveal, cardSx, Screen, ScreenHeader, TabBar } from './shared';

const STRIP = ['snow', 'forest', 'city', 'garden'] as const;

const ALBUMS = [
  { name: 'Nice 2025', count: '148 photos', scene: 'coast' as const },
  { name: 'Midsummer', count: '92 photos', scene: 'garden' as const },
  { name: 'Lapland', count: '64 photos', scene: 'snow' as const },
  { name: 'Weekends', count: '212 photos', scene: 'forest' as const }
];

/** Tags are how a photo is found again, so the screen shows some. */
const TAGS = ['Nice', 'Summer', 'Us two', 'Sea'];

export function AlbumScreen({ playing }: { playing: boolean }) {
  return (
    <Screen>
      <ScreenHeader title="Album" sub="A year ago today" accent={moduleAccent.album} />

      <Box sx={{ position: 'relative', ...reveal(playing, 0) }}>
        <PhotoTile scene="coast" radius={14} sx={{ width: '100%', height: 168 }} />
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            px: '11px',
            pt: '22px',
            pb: '10px',
            borderRadius: '0 0 14px 14px',
            background: 'linear-gradient(to top, rgba(15,23,42,0.6), rgba(15,23,42,0))'
          }}
        >
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>Nice, 12 September</Typography>
          <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>9 photos that day</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: '6px', mt: '8px' }}>
        {STRIP.map((scene, index) => (
          <PhotoTile
            key={scene}
            scene={scene}
            radius={9}
            sx={{
              flex: 1,
              aspectRatio: '1 / 1',
              opacity: playing ? 1 : 0,
              transform: playing ? 'none' : 'scale(0.86)',
              transition: `opacity .4s ease ${200 + index * 110}ms, transform .4s ease ${200 + index * 110}ms`
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '5px', mt: '9px', ...reveal(playing, 360) }}>
        {TAGS.map((tag) => (
          <Typography
            key={tag}
            sx={{
              px: '8px',
              py: '3px',
              borderRadius: '999px',
              fontSize: 9,
              fontWeight: 600,
              color: moduleAccent.album,
              background: 'rgba(37,99,235,0.10)'
            }}
          >
            {tag}
          </Typography>
        ))}
      </Box>

      <Box sx={{ ...cardSx, mt: '9px', ...reveal(playing, 460) }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.muted, mb: '8px' }}>
          Albums
        </Typography>
        {ALBUMS.map((album, index) => (
          <Box key={album.name} sx={{ display: 'flex', alignItems: 'center', gap: '9px', mt: index === 0 ? 0 : '8px' }}>
            <PhotoTile scene={album.scene} radius={7} sx={{ width: 34, height: 34, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: ink.strong }}>{album.name}</Typography>
              <Typography sx={{ fontSize: 9, color: ink.muted }}>{album.count}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <TabBar active="album" />
    </Screen>
  );
}
