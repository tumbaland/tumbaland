import { ReactNode } from 'react';
import Container from '@mui/material/Container';
import { Box } from '@mui/material';

interface AppLayoutProps { children: ReactNode; }

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Container maxWidth="xl" sx={{ flex: 1, py: 0 }}>
        {children}
      </Container>
    </Box>
  );
};

export default AppLayout;
