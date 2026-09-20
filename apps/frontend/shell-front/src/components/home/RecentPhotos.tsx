import { Box, ButtonBase } from '@mui/material';
import { SectionLabel } from './SectionLabel';
import type { HomePhoto } from '../../services/homeApi';

interface RecentPhotosProps {
  photos: HomePhoto[];
  onOpen: (route: string) => void;
}

/**
 * The latest photos, as a row of thumbnails that scrolls sideways.
 *
 * A strip rather than a grid: it says "there is new stuff in here" in one
 * glance and one line of height, which is all the home page should spend on
 * something the Album tab opens properly.
 */
export function RecentPhotos({ photos, onOpen }: RecentPhotosProps) {
  if (photos.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="home-recent-photos">
      <SectionLabel id="home-recent-photos">Lately</SectionLabel>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          // The strip runs to the edge of the screen on a phone, so the last
          // thumbnail being half-cut is the cue that it scrolls.
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {photos.map((photo) => (
          <ButtonBase
            key={photo._id}
            onClick={() => onOpen(`/album/albums/${photo.albumId}`)}
            aria-label={photo.title?.trim() || photo.originalName}
            sx={{
              flexShrink: 0,
              width: { xs: 88, md: 104 },
              height: { xs: 88, md: 104 },
              borderRadius: 3,
              overflow: 'hidden',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform .15s ease',
              '&:hover': { transform: 'translateY(-2px)' },
              '&:active': { transform: 'scale(0.97)' }
            }}
          >
            <Box
              component="img"
              src={photo.thumbnailSignedUrl ?? photo.signedUrl}
              alt=""
              loading="lazy"
              // A square crop of a tall photo, biased well above centre: the
              // middle of a portrait is a torso. Cropped rather than fitted,
              // unlike the memory card — an 88px tile that letterboxed would
              // be mostly blur, and this is a glance, not a look.
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 25%',
                display: 'block'
              }}
            />
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

export default RecentPhotos;
