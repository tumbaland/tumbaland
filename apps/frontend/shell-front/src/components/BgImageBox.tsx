import { memo } from 'react';
import { Box } from '@mui/material';

const BgImageBox = memo(function BgImageBox() {
  return (
    <Box
      component="img"
      src="/background.png"
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0,
        // Per scheme, as variables rather than a dark-only style, so a page
        // scoped to light (the landing page) keeps its light clouds.
        opacity: 'var(--tl-backdrop-opacity)',
        mixBlendMode: 'var(--tl-backdrop-blend)' as 'normal',
        pointerEvents: 'none',
        userSelect: 'none',
        // Enable hardware acceleration
        transform: 'translate3d(0, 0, 0)',
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 100%)'
      }}
    />
  );
});

export default BgImageBox;
