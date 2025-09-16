import { useLocation } from 'react-router-dom';
import { useState, ReactNode, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { SideMenu } from './SideMenu';
import { HeaderNav } from './HeaderNav';
import { ProtectedRoute } from './ProtectedRoute';
import Footer from './Footer';
import { getAppByRoute } from '../config/apps';
import { useConfig } from '../hooks/useConfig';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const config = useConfig();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const currentApp = getAppByRoute(location.pathname);
  const appUrl = currentApp?.urlKey ? config[currentApp.urlKey] : undefined;
  const showIframe = appUrl && location.pathname !== '/';

  useEffect(() => {
    if (showIframe) {
      setLoading(true);
    }
  }, [appUrl]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        height: '100dvh',
        width: '100dvw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Header Navigation for Account/Groups/Billing */}
      <HeaderNav currentRoute={location.pathname} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SideMenu currentRoute={location.pathname} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            position: 'relative',
            marginLeft: showIframe ? (isMobile ? 0 : 60) : 0,
            transition: 'margin-left 0.3s',
            overflow: 'auto'
          }}
        >
          {showIframe ? (
            <ProtectedRoute>
              <>
                {loading && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
                      zIndex: 2
                    }}
                  >
                    <CircularProgress />
                  </div>
                )}
                <iframe
                  src={appUrl}
                  title={currentApp!.name}
                  style={{ width: '100%', height: '100%', border: 'none', zIndex: 1 }}
                  allow="fullscreen"
                  onLoad={() => setLoading(false)}
                />
              </>
            </ProtectedRoute>
          ) : (
            children
          )}
        </div>
      </div>

      <Footer isVisible={location.pathname !== '/'} />
    </div>
  );
}
