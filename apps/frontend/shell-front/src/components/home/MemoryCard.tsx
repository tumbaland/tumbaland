import { Box, ButtonBase, Typography } from '@mui/material';
import { brand, ink } from '@tumbaland/frontend-core';
import type { Memories, MemoryYear } from '../../services/homeApi';

interface MemoryCardProps {
  memories: Memories;
  onOpen: (route: string) => void;
}

/** "2 years ago today", or "Last year today" where a year reads better than a count. */
export function yearsAgoLabel(yearsAgo: number): string {
  if (yearsAgo <= 0) return 'Earlier today';
  if (yearsAgo === 1) return 'A year ago today';
  return `${yearsAgo} years ago today`;
}

/** The year with the most to show, so the card is never built around a single stray photo. */
export function pickYear(years: MemoryYear[]): MemoryYear | null {
  const withPhotos = years.filter((year) => year.photos.length > 0);
  if (withPhotos.length === 0) return null;
  return withPhotos.reduce((best, year) => (year.photos.length > best.photos.length ? year : best));
}

/**
 * What you were doing on this date in earlier years.
 *
 * The one thing on this page that is different every morning, so it gets the
 * top of it and the only full-bleed image. Everything else here is navigation
 * dressed up; this is the reason to open the app on a day you had no errand.
 *
 * Silent on a day with no history: a card saying "no memories today" is a
 * worse start than the greeting going straight into the rest of the page.
 */
export function MemoryCard({ memories, onOpen }: MemoryCardProps) {
  const year = pickYear(memories.years);
  if (!year) return null;

  const [lead, ...rest] = year.photos;
  const others = rest.slice(0, 3);
  const albumName = lead.albumName;

  return (
    <ButtonBase
      onClick={() => onOpen(`/album/albums/${lead.albumId}`)}
      aria-label={`${yearsAgoLabel(year.yearsAgo)}, in ${albumName}`}
      sx={{
        width: '100%',
        display: 'block',
        textAlign: 'left',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        // Tall enough to be a picture rather than a banner, short enough that
        // the rest of the page is still on screen on a phone.
        height: { xs: 260, md: 320 },
        boxShadow: '0 20px 44px -28px rgba(88,28,135,0.7)',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform .2s ease, box-shadow .2s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 26px 52px -28px rgba(88,28,135,0.8)' },
        '&:hover .memory-photo': { transform: 'scale(1.03)' }
      }}
    >
      <Box
        className="memory-photo"
        component="img"
        src={lead.signedUrl ?? lead.thumbnailSignedUrl}
        alt=""
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'transform .35s ease'
        }}
      />

      {/* Dark only where the words sit: a scrim over the whole photo is what
          makes a memory look like a stock header. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.25) 42%, transparent 70%)'
        }}
      />

      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 2, md: 2.5 } }}>
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#fbcfe8',
            mb: 0.5
          }}
        >
          {yearsAgoLabel(year.yearsAgo)}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: { xs: '1.3rem', md: '1.5rem' }, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}
        >
          {lead.title?.trim() || albumName}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', mt: 0.25 }}>
          {year.photoCount === 1 ? '1 photo' : `${year.photoCount} photos`}
          {lead.title?.trim() ? ` in ${albumName}` : ''}
        </Typography>
      </Box>

      {/* A hint that the card opens onto more than the one picture. */}
      {others.length > 0 && (
        <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 0.75 }}>
          {others.map((photo) => (
            <Box
              key={photo._id}
              component="img"
              src={photo.thumbnailSignedUrl ?? photo.signedUrl}
              alt=""
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.8)',
                boxShadow: '0 6px 14px -8px rgba(15,23,42,0.9)'
              }}
            />
          ))}
        </Box>
      )}
    </ButtonBase>
  );
}

/** The accent the label uses, exported so a test can assert it stays on-brand. */
export const MEMORY_ACCENT = brand.pink;
/** Kept for the empty-state copy a caller may want to render instead. */
export const MEMORY_MUTED = ink.muted;

export default MemoryCard;
