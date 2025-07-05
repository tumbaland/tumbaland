import { useNavigate, useLocation } from 'react-router-dom';
import { useState, ReactNode, useContext } from 'react';

import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CircularProgress from '@mui/material/CircularProgress';
import { SideMenu } from './SideMenu';
import { ConfigContext } from '../App';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const config = useContext(ConfigContext);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const appLinks = [
    {
      name: 'Relationship',
      route: '/relationship',
      url: config.VITE_RELATIONSHIP_URL || 'http://localhost:3001',
      icon: <FavoriteIcon sx={{ color: '#334155' }} />,
    },
    {
      name: 'Album',
      route: '/album',
      url: config.VITE_ALBUM_URL || 'http://localhost:3002',
      icon: <AlbumIcon sx={{ color: '#334155' }} />,
    },
    {
      name: 'Finance',
      route: '/finance',
      url: config.VITE_FINANCE_URL || 'http://localhost:3003',
      icon: <AttachMoneyIcon sx={{ color: '#334155' }} />,
    },
  ];

  // Map route paths to app URLs
  const routeToUrl: Record<string, string> = {
    '/relationship': appLinks[0].url,
    '/album': appLinks[1].url,
    '/finance': appLinks[2].url,
  };

  // Determine which iframe to show based on the route
  const iframeUrl = routeToUrl[location.pathname] || null;

  const handleLinkClick = (url: string) => {
    // Find the route for the clicked URL
    const route = Object.entries(routeToUrl).find(([, v]) => v === url)?.[0];
    if (route) {
      navigate(route);
      setLoading(true);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <SideMenu 
        appLinks={appLinks} 
        onLinkClick={handleLinkClick}
        currentRoute={location.pathname}
        routeToUrl={routeToUrl}
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'center', position: 'relative' }}>
        {iframeUrl ? (
          <>
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.6)',
                zIndex: 2,
              }}>
                <CircularProgress />
              </div>
            )}
            <iframe
              src={iframeUrl}
              title="App Content"
              style={{ width: '100%', height: '100vh', border: 'none', zIndex: 1 }}
              allow="fullscreen"
              onLoad={() => setLoading(false)}
            />
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
