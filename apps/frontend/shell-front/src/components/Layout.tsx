import { useLocation, useNavigate } from 'react-router-dom';
import { useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { ProtectedRoute, buildEmbeddedUrl, extractChildPath, useShellBridge } from '@tumbaland/components';
import { SideMenu } from './SideMenu';
import { HeaderNav } from './HeaderNav';
import Footer from './Footer';
import { getAppByRoute } from '../config/apps';
import { useConfig } from '../config/ConfigProvider';
import { authService } from '../services/authService';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const config = useConfig();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const frameRef = useRef<HTMLIFrameElement>(null);

  const currentApp = getAppByRoute(location.pathname);
  const appUrl = currentApp?.urlKey ? config[currentApp.urlKey] : undefined;
  const appKey = currentApp && appUrl ? `${currentApp.route}|${appUrl}` : null;

  // The iframe src is captured once per app: the deep-linked path rides along on
  // first mount, but every later navigation goes over postMessage. Recomputing
  // src per route would reload the whole child app on each click, so it is
  // derived during render and only refreshed when the app itself changes.
  const [frameSrc, setFrameSrc] = useState<{ key: string; src: string } | null>(null);
  if (appKey && currentApp && appUrl && frameSrc?.key !== appKey) {
    setFrameSrc({
      key: appKey,
      src: buildEmbeddedUrl(appUrl, extractChildPath(currentApp.route, location.pathname, location.search))
    });
  }
  const showIframe = appKey !== null && frameSrc?.key === appKey;

  const handleChildNavigate = useCallback(
    (shellPath: string, options: { replace: boolean }) => navigate(shellPath, { replace: options.replace }),
    [navigate]
  );

  const handleChildTitle = useCallback((title: string) => {
    if (title) document.title = title;
  }, []);

  useShellBridge({
    frameRef,
    appRoute: currentApp?.route,
    appUrl,
    shellPath: location.pathname,
    shellSearch: location.search,
    onNavigate: handleChildNavigate,
    onTitleChange: handleChildTitle
  });

  useEffect(() => {
    if (appKey) {
      setLoading(true);
    }
  }, [appKey]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        height: '100dvh',
        width: '100dvw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at 50% 0%, #f0f4ff 0%, #e0e7ff 50%, #f8fafc 100%)',
        fontFamily: '"Inter", "Roboto", sans-serif'
      }}
    >
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.2);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.4);
        }
      `}</style>
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
            <ProtectedRoute authService={authService}>
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
                  key={appKey!}
                  ref={frameRef}
                  src={frameSrc!.src}
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
