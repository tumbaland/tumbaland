import { useCallback, useEffect, useState } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Memories, MemoryYear } from '../../services/homeApi';
import { MediaThumb } from '@tumbaland/frontend-core';

interface MemoryCardProps {
  memories: Memories;
  onOpen: (route: string) => void;
}

/** "2 years ago today", or "A year ago today" where a year reads better than a count. */
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
 * The other photos from that day used to sit in the corner as three small
 * chips: too small to make out, and tapping one opened the album rather than
 * the picture, so the only thing they did was take you away from the card.
 * They are slides now — the card is the viewer, and leaving it is a separate,
 * deliberate tap.
 *
 * Silent on a day with no history: a card saying "no memories today" is a
 * worse start than the greeting going straight into the rest of the page.
 */
export function MemoryCard({ memories, onOpen }: MemoryCardProps) {
  const year = pickYear(memories.years);
  const photos = year?.photos ?? [];
  const [index, setIndex] = useState(0);

  // A new day's memories are a different set; staying on slide 4 of the last
  // one would land past the end.
  useEffect(() => {
    setIndex(0);
    setLoaded(new Set([0]));
  }, [year?.year]);

  const step = useCallback(
    (by: number) => setIndex((current) => (current + by + photos.length) % photos.length),
    [photos.length]
  );

  // Which slides have been looked at, and so are worth the full-size file.
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set([0]));
  useEffect(() => {
    setLoaded((shown) => (shown.has(index) ? shown : new Set(shown).add(index)));
  }, [index]);

  if (!year || photos.length === 0) return null;

  const current = photos[Math.min(index, photos.length - 1)];
  const albumName = year.photos[0].albumName;
  const many = photos.length > 1;

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        height: { xs: 260, md: 340 },
        boxShadow: '0 20px 44px -28px rgba(88,28,135,0.7)'
      }}
    >
      {/* Every slide stays mounted and fades, so stepping back does not
          re-request an image the browser has already been given. */}
      {photos.map((photo, slide) => (
        <Box
          key={photo._id}
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: slide === index ? 1 : 0,
            transition: 'opacity .35s ease'
          }}
        >
          {/* Blurred and cropped to fill, behind the photo, so a shape that
              does not match the card has something to sit on rather than bars
              of flat colour. The 300px thumbnail is plenty at this blur. */}
          <MediaThumb
            src={(photo.thumbnailSignedUrl ?? photo.signedUrl)!}
            mimetype={photo.mimetype}
            aria-hidden
            sx={{ ...fill, objectFit: 'cover', filter: 'blur(18px)', transform: 'scale(1.15)' }}
          />

          {/* The thumbnail again, whole and framed exactly as the full-size
              one will be, so it is on screen in a few tens of kilobytes and
              nothing shifts when the real file arrives. */}
          <MediaThumb
            src={(photo.thumbnailSignedUrl ?? photo.signedUrl)!}
            mimetype={photo.mimetype}
            aria-hidden
            sx={{ ...fill, objectFit: 'contain' }}
          />

          {/* The real thing, fetched only for slides that have actually been
              looked at. Every slide used to load its full-size original the
              moment the page opened, so a day with eight photos downloaded
              eight of them before showing one. */}
          {loaded.has(slide) && (
            <MediaThumb
              src={(photo.signedUrl ?? photo.thumbnailSignedUrl)!}
              mimetype={photo.mimetype}
              onLoad={(event) => {
                event.currentTarget.style.opacity = '1';
              }}
              sx={{ ...fill, objectFit: 'contain', opacity: 0, transition: 'opacity .3s ease' }}
            />
          )}
        </Box>
      ))}

      {/* Dark only where the words sit: a scrim over the whole photo is what
          makes a memory look like a stock header. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.25) 42%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      {/* The caption opens the album. A tap anywhere else on the card steps the
          carousel, so browsing the day never costs you the page. */}
      <ButtonBase
        onClick={() => onOpen(`/album/albums/${current.albumId}?view=${current._id}`)}
        aria-label={`Open ${albumName}`}
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'block',
          textAlign: 'left',
          p: { xs: 2, md: 2.5 },
          WebkitTapHighlightColor: 'transparent'
        }}
      >
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
          {current.title?.trim() || albumName}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', mt: 0.25 }}>
          {year.photoCount === 1 ? '1 photo' : `${year.photoCount} photos`}
          {current.title?.trim() ? ` in ${albumName}` : ''}
        </Typography>
      </ButtonBase>

      {many && (
        <>
          <Arrow side="left" onClick={() => step(-1)} label="Previous photo" />
          <Arrow side="right" onClick={() => step(1)} label="Next photo" />

          {/* Which slide, and how many there are, without counting arrows. */}
          <Box
            sx={{
              position: 'absolute',
              top: 14,
              right: 14,
              display: 'flex',
              gap: 0.75,
              alignItems: 'center',
              px: 1,
              py: 0.75,
              borderRadius: 999,
              backgroundColor: 'rgba(15,23,42,0.35)',
              backdropFilter: 'blur(6px)'
            }}
          >
            {photos.map((photo, slide) => (
              <Box
                key={photo._id}
                component="button"
                type="button"
                aria-label={`Photo ${slide + 1} of ${photos.length}`}
                aria-current={slide === index ? 'true' : undefined}
                onClick={() => setIndex(slide)}
                sx={{
                  width: slide === index ? 18 : 6,
                  height: 6,
                  p: 0,
                  border: 0,
                  borderRadius: 999,
                  cursor: 'pointer',
                  backgroundColor: slide === index ? '#fff' : 'rgba(255,255,255,0.55)',
                  transition: 'width .25s ease, background-color .25s ease'
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

/**
 * A layer of the card, filling it. `objectFit` is set per layer.
 *
 * The photo itself is `contain`, not `cover`. This card is about two and a
 * half times as wide as it is tall, so cropping a portrait to fill it leaves
 * roughly a fifth of the photo's height on screen — and centred, that fifth is
 * the middle: a torso, with the head above the top edge. Biasing the crop
 * upward helps a little and still loses the head on anything genuinely tall,
 * because there is no band of a portrait that is both a fifth of it and holds
 * the whole subject. So nothing is cropped, and the shortfall is filled by a
 * blurred copy behind rather than by cutting the picture.
 */
const fill = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%'
} as const;

interface ArrowProps {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}

/** Always on rather than shown on hover: on a touch screen there is no hover. */
function Arrow({ side, label, onClick }: ArrowProps) {
  return (
    <IconButton
      aria-label={label}
      onClick={onClick}
      size="small"
      sx={{
        position: 'absolute',
        top: '50%',
        [side]: 10,
        transform: 'translateY(-50%)',
        color: '#fff',
        backgroundColor: 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(6px)',
        '&:hover': { backgroundColor: 'rgba(15,23,42,0.55)' }
      }}
    >
      {side === 'left' ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
    </IconButton>
  );
}

export default MemoryCard;
