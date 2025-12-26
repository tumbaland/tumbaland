import { ReactNode } from 'react';
import Container from '@mui/material/Container';
import AuthHeader from './AuthHeader';
import { Box } from '@mui/material';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 0%, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)',
        display: 'flex'
      }}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AuthHeader />
        <Container maxWidth="xl">{children}</Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
