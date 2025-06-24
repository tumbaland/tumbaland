import { SideMenu } from '@tumbaland/components/side-menu';
import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { ReactNode } from 'react';
import Container from "@mui/material/Container";
import AppHeader from './AppHeader';
import { Box } from '@mui/material';

const iconColor = '#334155';
const appLinks = [
  {
    name: 'Album',
    url: import.meta.env.VITE_ALBUM_URL || 'http://localhost:3003',
    icon: <AlbumIcon sx={{ color: iconColor }} />,
  },
  {
    name: 'Relationship',
    url: import.meta.env.VITE_RELATIONSHIP_URL || 'http://localhost:3002',
    icon: <FavoriteIcon sx={{ color: iconColor }} />,
  },
  {
    name: 'Finance',
    url: import.meta.env.VITE_FINANCE_URL || 'http://localhost:3001',
    icon: <AttachMoneyIcon sx={{ color: iconColor }} />,
  },
];

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex' }}>
      <SideMenu appLinks={appLinks} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AppHeader />
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
