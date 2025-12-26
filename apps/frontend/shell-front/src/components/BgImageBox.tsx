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
        opacity: 0.4,
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
