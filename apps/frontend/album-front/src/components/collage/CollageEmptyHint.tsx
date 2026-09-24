import React from 'react';
import { Box, Typography } from '@mui/material';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';

/**
 * Over an empty canvas: where the photos come from, which is otherwise only
 * a caption at the top of the tray. Never in the way: it lets every click
 * through, and goes as soon as anything is on the canvas.
 */
const CollageEmptyHint: React.FC<{ trayBelow: boolean }> = ({ trayBelow }) => (
  <Box
    aria-hidden
    sx={{
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      display: 'grid',
      placeItems: 'center',
      pointerEvents: 'none',
      p: 2
    }}
  >
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        px: 3,
        py: 2,
        maxWidth: 320,
        textAlign: 'center',
        borderRadius: 3,
        color: 'rgba(255,255,255,0.92)',
        bgcolor: 'rgba(28,28,30,0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 36, opacity: 0.85 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Start with a photo
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
        {trayBelow ? 'Tap a photo below to add it.' : 'Click a photo in the tray, or drag it onto the canvas.'}
      </Typography>
    </Box>
  </Box>
);

export default CollageEmptyHint;
