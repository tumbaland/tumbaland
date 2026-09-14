import { useLocation, useNavigate } from 'react-router';
import { useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { ProtectedRoute, buildEmbeddedUrl, extractChildPath, useShellBridge } from '@tumbaland/components';
import { AppNav } from './AppNav';
import { getAppByRoute } from '../config/apps';
import { useConfig } from '../config/ConfigProvider';
import { authService } from '../services/authService';
import { recordLastVisited } from '../services/lastVisited';
import { useAuthState } from '../hooks/useAuthState';
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
  // Read synchronously. The default first pass assumes a wide screen, which
  // would draw the rail on a phone for a frame before swapping in the tab bar.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The navigation only links to apps that require a session, so signed-out
  // visitors (who see the public landing page at `/`) get no app chrome at all.
  // It stays hidden while the check is in flight so the landing page never
  // flashes a nav it is about to lose.
  const { authenticated, user } = useAuthState();

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

  // Signing out inside a framed app ends the shell's session too. A router
  // navigation would keep this document — and its cached auth check — alive,
  // so leave for `/` the hard way and let the shell boot signed out.
  const handleChildLogout = useCallback(() => {
    authService.clearAuthCache();
    window.location.assign('/');
  }, []);

  useShellBridge({
    frameRef,
    appRoute: currentApp?.route,
    appUrl,
    shellPath: location.pathname,
    shellSearch: location.search,
    onNavigate: handleChildNavigate,
    onTitleChange: handleChildTitle,
    onChildLogout: handleChildLogout
  });

  useEffect(() => {
    if (appKey) {
      setLoading(true);
    }
  }, [appKey]);

  // Remember the module being viewed so the home page can offer a way back.
  useEffect(() => {
    if (currentApp) {
      recordLastVisited(location.pathname);
    }
  }, [currentApp, location.pathname]);

  const nav = authenticated ? <AppNav currentRoute={location.pathname} user={user} mobile={isMobile} /> : null;

  return (
    <div
      style={{
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
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

      {/* A rail beside the content on wider screens, a tab bar under it on
          phones, where it stays in reach of a thumb and clear of each
          module's own header. */}
      {!isMobile && nav}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          position: 'relative',
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

      {isMobile && nav}
    </div>
  );
}
