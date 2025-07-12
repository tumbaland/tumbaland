import { memo } from 'react';
import { Box } from '@mui/material';

const BgImageBox = memo(function BgImageBox() {
  return (
    <Box
      component="img"
      src="/background.png"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
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
