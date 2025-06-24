import React, { ReactNode } from 'react';
import { SideMenu } from '@tumbaland/components/side-menu';
import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

const iconColor = '#334155'; // dark gray

const appLinks = [
  {
    name: 'Album',
    url: import.meta.env.VITE_ALBUM_URL || 'http://localhost:3001',
    icon: <AlbumIcon sx={{ color: iconColor }} />,
  },
  {
    name: 'Relationship',
    url: import.meta.env.VITE_RELATIONSHIP_URL || 'http://localhost:3002',
    icon: <FavoriteIcon sx={{ color: iconColor }} />,
  },
  {
    name: 'Finance',
    url: import.meta.env.VITE_FINANCE_URL || 'http://localhost:3003',
    icon: <AttachMoneyIcon sx={{ color: iconColor }} />,
  },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <SideMenu appLinks={appLinks} />
      {children}
    </div>
  );
}
