import { useLocation } from 'react-router-dom';
import { useState, ReactNode, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { SideMenu } from './SideMenu';
import { getAppByRoute } from '../config/apps';
import { useConfig } from '../hooks/useConfig';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const config = useConfig();
  
  const currentApp = getAppByRoute(location.pathname);
  const appUrl = currentApp?.urlKey ? config[currentApp.urlKey] : undefined;
  const showIframe = appUrl && location.pathname !== '/';

  useEffect(() => {
    if (showIframe) {
      setLoading(true);
    }
  }, [appUrl]); // Trigger loading when the URL changes, not just showIframe

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <SideMenu currentRoute={location.pathname} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'center', position: 'relative' }}>
        {showIframe ? (
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
              src={appUrl}
              title={currentApp!.name}
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
