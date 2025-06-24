import { ReactNode } from 'react';
import Container from "@mui/material/Container";
import AuthHeader from './AuthHeader';
import { Box } from '@mui/material';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <AuthHeader title="Album" />
      <Container maxWidth="xl">
        {children}
      </Container>
    </Box>
  );
};

export default AppLayout;
