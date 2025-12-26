import { ReactNode } from 'react';
import Container from '@mui/material/Container';
import { Box } from '@mui/material';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 0%, #f0f4ff 0%, #e0e7ff 50%, #f8fafc 100%)',
        fontFamily: '"Inter", "Roboto", sans-serif'
      }}
    >
      <Container maxWidth="xl" sx={{ height: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Container>
    </Box>
  );
};

export default AppLayout;
