import { useLocation, useNavigate } from 'react-router';
import { ReactNode, useEffect, useState } from 'react';
import { Loader, ProtectedRoute, surface, TenantSelector, useTenant } from '@tumbaland/frontend-core';
import { AppNav } from './AppNav';
import { RemoteOutlet } from './RemoteOutlet';
import { CHAT_APP, getAppByRoute, isRouteActive } from '../config/apps';
import { useConfig } from '../config/ConfigProvider';
import { authService } from '../services/authService';
import { useAuthState } from '../hooks/useAuthState';
import { useUnreadChat } from '../hooks/useUnreadChat';
import { useShowMoney } from '../hooks/useShowMoney';
import { useKeyboardAwareHeight } from '../hooks/useKeyboardAwareHeight';
import { UpdatePrompt } from './UpdatePrompt';
import { onWorkerMessage, registerServiceWorker } from '../services/serviceWorker';
import { refreshSubscription } from '../services/pushNotifications';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { ModuleHeader } from './ModuleHeader';
import { ChatPanel } from './ChatPanel';
import { ChatDockHost } from './ChatDockHost';
import { CallLayer } from './CallLayer';

/** Whether the desktop chat panel was left open, so it stays that way across visits. */
const CHAT_PANEL_KEY = 'tumbaland.chatPanel.open';

function readChatPanelOpen(): boolean {
  try {
    return localStorage.getItem(CHAT_PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

interface LayoutProps {
  children: ReactNode;
}

/**
 * How wide a module's content column is allowed to get, matching MUI's `xl`
 * breakpoint — the cap Album's own pages already used, now applied to all of
 * them. Past this a table or a photo grid stops being scannable because the
 * eye has to travel the whole monitor to follow a row.
 */
const CONTENT_MAX_WIDTH = 1536;

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
  const { authenticated, user, loading: authLoading } = useAuthState();
  // Money is in the menu only for someone who turned it on under Features.
  const { showMoney } = useShowMoney(authenticated ? user?.id : undefined);
  const { GROUP_API_URL } = useConfig();
  // Content waits for the context to settle (below), so a group restored on
  // sign-in is just stored rather than reloading the page a second time.
  const tenant = useTenant(GROUP_API_URL ?? '', authenticated ? user?.id : undefined, { waitsForReady: true });

  const currentApp = getAppByRoute(location.pathname);
  const navigate = useNavigate();
  const [updateReady, setUpdateReady] = useState(false);

  // The unread count for the Chat button and the installed app's icon.
  // Re-read on every route change, so the badge clears as soon as a thread
  // that was just read is left rather than up to a minute later.
  const [chatPanelOpen, setChatPanelOpen] = useState(readChatPanelOpen);
  const toggleChatPanel = () => setChatPanelOpen((open) => !open);
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PANEL_KEY, chatPanelOpen ? '1' : '0');
    } catch {
      // Private mode: it just starts closed next time.
    }
  }, [chatPanelOpen]);
  // The panel reads and marks messages, so opening or closing it re-reads the
  // count too.
  const unreadChat = useUnreadChat(authenticated, `${location.pathname}|${chatPanelOpen}`);

  // A thread takes the whole screen on a phone: the tab bar under it costs a
  // fifth of the height, and the header already carries the way back out. The
  // conversation list keeps the tab bar, where Chat now lives.
  const inChat = isRouteActive(CHAT_APP.route, location.pathname);
  const inThread = inChat && location.pathname.replace(/\/+$/, '') !== CHAT_APP.route;

  // Desktop only, and not on the chat page itself, which would be the same
  // conversation twice with two live connections.
  // Nor while a module has chat docked in its own page: that would be two copies.
  const [chatDocked, setChatDocked] = useState(false);
  const showChatPanel = authenticated && !isMobile && !inChat && chatPanelOpen && !chatDocked;

  // How tall the app may be right now, which is less than the screen while the
  // on-screen keyboard is up. See the hook for why `100dvh` alone is not enough.
  const appHeight = useKeyboardAwareHeight();

  // The worker belongs to this origin, so it is registered here rather than in
  // the chat module, which runs inside this page and has no worker of its own.
  useEffect(() => registerServiceWorker(() => setUpdateReady(true)), []);

  // Tapping a notification focuses an open window instead of opening a second
  // one; the worker cannot route, so it asks the page to.
  useEffect(
    () =>
      onWorkerMessage((message) => {
        if (message.type === 'NAVIGATE') navigate(message.url);
        if (message.type === 'PUSH_RESUBSCRIBED') void refreshSubscription();
      }),
    [navigate]
  );

  // Re-registered on every start: a push endpoint can be rotated at any time,
  // and re-POSTing is how that is noticed. Silent, and never prompts.
  useEffect(() => {
    if (authenticated) void refreshSubscription();
  }, [authenticated]);

  const nav = authenticated ? (
    <AppNav
      currentRoute={location.pathname}
      user={user}
      mobile={isMobile}
      unreadChat={unreadChat}
      showMoney={showMoney}
    />
  ) : null;

  // One bar for the whole signed-in session: where you are, where else you can
  // go inside it, and whose data you are looking at. It was a module dropdown
  // and a tenant button in a hand-rolled div, while Profile and Billing drew a
  // second row of tabs of their own underneath.
  const header =
    authenticated && user ? (
      <ModuleHeader
        app={currentApp}
        currentRoute={location.pathname}
        mobile={isMobile}
        unreadChat={unreadChat}
        onToggleChat={isMobile ? undefined : toggleChatPanel}
        chatOpen={showChatPanel}
        end={
          <TenantSelector
            selectedTenant={tenant.selectedTenant}
            tenants={tenant.availableTenants}
            onTenantChange={tenant.setSelectedTenant}
            loading={tenant.loading}
            error={tenant.error}
            compact={isMobile}
            sx={{
              flexShrink: 0,
              maxWidth: isMobile ? 'clamp(120px, 40vw, 200px)' : 'min(280px, 32vw)',
              '& button': { width: '100%', minWidth: 0 },
              '& button > .MuiBox-root': { minWidth: 0 }
            }}
          />
        }
      />
    ) : null;

  return (
    // Kept clear of the notch, the status bar and rounded corners. index.html
    // opts into the whole screen (viewport-fit=cover), so an iPhone in landscape
    // already reports side insets in a browser, and an app's web view reports
    // the status bar as well. The bottom edge is the tab bar's (see AppNav).
    <div
      // Signed out, everything here is public — the landing page and the
      // documents — and it is drawn for light, with pastel mock screens that
      // have no dark version. Scoping it light keeps it whole on a device set
      // to dark. Not while the session is still being checked, so a signed-in
      // person in dark does not see a light frame first.
      data-color-scheme={!authLoading && !authenticated ? 'light' : undefined}
      style={{
        colorScheme: !authLoading && !authenticated ? 'light' : undefined,
        height: appHeight,
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

      <UpdatePrompt open={updateReady} onDismiss={() => setUpdateReady(false)} />

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
        {header}

        {/* One column width for every module. Album capped its own pages at
            `xl` and centred them while Journal and Money ran to the edge of the
            window, so crossing between them on a desktop moved the content
            sideways. The cap belongs to the chrome, not to whichever module
            remembered to add one.
            
            It is a cap on a *module*, though. The shell's own pages set their
            own width — the privacy and terms pages hold themselves to a
            reading measure, and the home page is a full-bleed backdrop with a
            narrow column floated on top, which a cap here cropped to a band
            down the middle of the screen. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            width: '100%',
            boxSizing: 'border-box',
            // A thread runs edge to edge on a phone, like every messaging app;
            // the gutter only wastes the width of a bubble.
            paddingInline: isMobile && !inChat ? 12 : 0,
            ...(currentApp ? { maxWidth: CONTENT_MAX_WIDTH, marginInline: 'auto' } : null)
          }}
        >
          {authenticated && !tenant.ready ? (
            // Every page reads the context as it mounts; drawn before it
            // settles, it would load with the wrong group and need a reload.
            <Loader message="Loading" />
          ) : currentApp ? (
            <ProtectedRoute authService={authService}>
              <RemoteOutlet />
            </ProtectedRoute>
          ) : (
            children
          )}
        </div>
      </div>

      {showChatPanel && <ChatPanel onClose={toggleChatPanel} />}

      {authenticated && <ChatDockHost onDockedChange={setChatDocked} />}

      {authenticated && <CallLayer />}

      {isMobile && !inThread && nav}
    </div>
  );
}
