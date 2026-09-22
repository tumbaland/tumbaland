import type { SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

export interface MediaThumbProps {
  /** Missing while a link could not be signed; the tile then shows its own fallback around it. */
  src?: string;
  /** The item's file type. A video is drawn as its own first frame. */
  mimetype?: string | null;
  alt?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: (event: SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => void;
  sx?: SxProps<Theme>;
  'aria-hidden'?: boolean;
}

/**
 * A photo, or a video's first frame, sized by whoever places it.
 *
 * A video has no still image of its own here (its "thumbnail" link is the
 * video file), so an <img> pointed at it drew nothing. This asks the browser
 * for the frame 0.1s in instead; without that fragment iOS draws black. It is
 * a still, not a player: muted, silent, and click-through, so taps belong to
 * whatever tile it sits in.
 */
export function MediaThumb({ src, mimetype, alt = '', loading, onLoad, sx, ...rest }: MediaThumbProps) {
  if (mimetype?.startsWith('video/')) {
    return (
      <Box
        component="video"
        src={src ? `${src}#t=0.1` : undefined}
        muted
        playsInline
        preload="metadata"
        aria-label={alt || undefined}
        onLoadedData={onLoad}
        sx={[{ pointerEvents: 'none' }, ...(Array.isArray(sx) ? sx : [sx])]}
        {...rest}
      />
    );
  }
  return <Box component="img" src={src} alt={alt} loading={loading} onLoad={onLoad} sx={sx} {...rest} />;
}

export default MediaThumb;
