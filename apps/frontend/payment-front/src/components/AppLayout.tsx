import { ReactNode } from 'react';
import Container from '@mui/material/Container';
import { Box } from '@mui/material';
import AuthHeader from './AuthHeader';

interface AppLayoutProps { children: ReactNode; }

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AuthHeader />
  <Container maxWidth="xl">{children}</Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
