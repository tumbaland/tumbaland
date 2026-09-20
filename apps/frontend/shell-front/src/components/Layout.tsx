import { useLocation } from 'react-router';
import { ReactNode, useEffect } from 'react';
import { ProtectedRoute, surface, TenantSelector, useTenant } from '@tumbaland/frontend-core';
import { AppNav } from './AppNav';
import { RemoteOutlet } from './RemoteOutlet';
import { getAppByRoute } from '../config/apps';
import { useConfig } from '../config/ConfigProvider';
import { authService } from '../services/authService';
import { recordLastVisited } from '../services/lastVisited';
import { useAuthState } from '../hooks/useAuthState';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { getModuleMenu } from './ModuleMenu';

interface LayoutProps {
  children: ReactNode;
}

/**
 * The chrome around every page: the navigation, and whichever module owns the
 * current address.
 *
 * Modules used to be iframes, one at a time, replaced on every switch. That
 * threw away the running app's whole JS context each time — so opening a module
 * re-checked the session, re-fetched its data, and lost whatever the previous
 * one had on screen. They are module-federation remotes now: loaded once into
 * this page and kept, so a second visit renders immediately and the navigation
 * never unmounts.
 */
export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const theme = useTheme();
  // Read synchronously. The default first pass assumes a wide screen, which
  // would draw the rail on a phone for a frame before swapping in the tab bar.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  // The navigation only links to apps that require a session, so signed-out
  // visitors (who see the public landing page at `/`) get no app chrome at all.
  // It stays hidden while the check is in flight so the landing page never
  // flashes a nav it is about to lose.
  const { authenticated, user } = useAuthState();
  const { GROUP_API_URL } = useConfig();
  const tenant = useTenant(GROUP_API_URL ?? '', authenticated ? user?.email : undefined);

  const currentApp = getAppByRoute(location.pathname);

  // Remember the module being viewed so the home page can offer a way back.
  useEffect(() => {
    if (currentApp) {
      recordLastVisited(location.pathname);
    }
  }, [currentApp, location.pathname]);

  const nav = authenticated ? <AppNav currentRoute={location.pathname} user={user} mobile={isMobile} /> : null;
  const tenantBar =
    authenticated && user ? (
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: isMobile ? 8 : 16,
          minHeight: 68,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(14px) saturate(180%)',
          WebkitBackdropFilter: 'blur(14px) saturate(180%)'
        }}
      >
        {getModuleMenu(currentApp, location.pathname)}
        <TenantSelector
          selectedTenant={tenant.selectedTenant}
          tenants={tenant.availableTenants}
          onTenantChange={tenant.setSelectedTenant}
          loading={tenant.loading}
          error={tenant.error}
          sx={{
            flex: isMobile ? '0 0 auto' : '0 1 min(360px, 38vw)',
            width: isMobile ? 'clamp(140px, 42vw, 220px)' : undefined,
            minWidth: isMobile ? 0 : 150,
            '& button': { width: '100%', minWidth: 0, px: isMobile ? 1 : undefined },
            '& button > .MuiBox-root': { minWidth: 0 },
            '& button .MuiTypography-root:last-child': { maxWidth: isMobile ? 120 : 'min(260px, 55vw)' }
          }}
        />
      </div>
    ) : null;

  return (
    // Kept clear of the notch, the status bar and rounded corners. index.html
    // opts into the whole screen (viewport-fit=cover), so an iPhone in landscape
    // already reports side insets in a browser, and an app's web view reports
    // the status bar as well. The bottom edge is the tab bar's (see AppNav).
    <div
      style={{
        height: '100dvh',
        width: '100%',
        boxSizing: 'border-box',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        background: surface.page
      }}
    >
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
          flexDirection: 'column',
          alignItems: 'stretch',
          position: 'relative',
          overflow: 'auto'
        }}
      >
        {tenantBar}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            paddingInline: isMobile ? 12 : 0,
            boxSizing: 'border-box'
          }}
        >
          {currentApp ? (
            <ProtectedRoute authService={authService}>
              <RemoteOutlet />
            </ProtectedRoute>
          ) : (
            children
          )}
        </div>
      </div>

      {isMobile && nav}
    </div>
  );
}
