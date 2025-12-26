import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import { GitHub, Circle } from '@mui/icons-material';

interface FooterProps {
  isVisible: boolean;
}

const Footer: React.FC<FooterProps> = ({ isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: 'calc(100% - 60px)' }, // Account for sidebar width on desktop
        height: '32px',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.3)',
        display: { xs: 'none', sm: 'flex' }, // Hide on extra small screens, show on small and up
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 1.5, sm: 2 },
        position: 'relative',
        left: { xs: 0, sm: '60px' }, // Move footer to the right of sidebar on desktop
        zIndex: 15
      }}
    >
      {/* Left side - GitHub link */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <GitHub sx={{ fontSize: { xs: '12px', sm: '14px' }, color: 'text.secondary' }} />
        <Link
          href="https://github.com/toomastahves/tumbaland"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            fontSize: { xs: '11px', sm: '12px' },
            color: 'text.secondary',
            textDecoration: 'none',
            '&:hover': {
              color: 'primary.main',
              textDecoration: 'underline'
            }
          }}
        >
          GitHub
        </Link>
      </Box>

      {/* Right side - Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontSize: { xs: '11px', sm: '12px' },
            color: 'text.secondary',
            fontWeight: 500
          }}
        >
          Status
        </Typography>
        <Circle
          sx={{
            fontSize: { xs: '6px', sm: '8px' },
            color: 'success.main'
          }}
        />
      </Box>
    </Box>
  );
};

export default Footer;