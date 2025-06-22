import { Box } from '@mui/material';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#faf0e6' }}>
      {children}
    </Box>
  );
};

export default Layout;
