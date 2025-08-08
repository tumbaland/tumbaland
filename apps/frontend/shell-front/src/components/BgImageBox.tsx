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
        opacity: 0.55,
        pointerEvents: 'none',
        userSelect: 'none',
        // Enable hardware acceleration
        transform: 'translate3d(0, 0, 0)'
      }}
    />
  );
});

export default BgImageBox;
