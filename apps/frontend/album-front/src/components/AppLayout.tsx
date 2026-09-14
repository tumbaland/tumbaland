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
        display: 'flex',
        fontFamily: '"Inter", "Roboto", sans-serif'
      }}
    >
      {/* minWidth 0: a flex item otherwise grows to fit its widest content, so a
          single wide row anywhere on a page (a strip of thumbnails, a long
          table) widened the whole app past the edge of a phone screen. */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AuthHeader />
        {/* Pages set their own vertical rhythm; 32px here on top of theirs was
            dead space above every page on a phone. */}
        <Container maxWidth="xl" sx={{ py: { xs: 1, sm: 4 } }}>{children}</Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
