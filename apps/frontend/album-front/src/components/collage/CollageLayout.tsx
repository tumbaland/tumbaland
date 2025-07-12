import React from 'react';
import { Box } from '@mui/material';

interface CollageLayoutProps {
  children: React.ReactNode;
}

const CollageLayout: React.FC<CollageLayoutProps> = ({ children }) => {
  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        bgcolor: '#222',
        color: '#fff',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  );
};

export default CollageLayout;
