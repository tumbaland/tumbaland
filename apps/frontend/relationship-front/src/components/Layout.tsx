import { Box } from '@mui/material';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex' }}>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  );
};

export default Layout;
