export { Loader } from './components/Loader';
export { ErrorPage } from './components/ErrorPage';
export { AppErrorBoundary } from './components/AppErrorBoundary';
export { UnauthorizedPage } from './components/UnauthorizedPage';
export { ProtectedRoute } from './components/ProtectedRoute';
export { LoginButton } from './components/LoginButton';
export { NotificationsMenu } from './components/NotificationsMenu/NotificationsMenu';
export { AuthHeader } from './components/AuthHeader';

// Entitlements: the usage bar and the hook that feeds it
export { UsageMeter, formatBytes, useEntitlements } from './components/UsageMeter';

// Tenant selection: provider, selector, and hooks shared across domain frontends
export {
  TenantSelector,
  TenantProvider,
  useTenant,
  useTenantListener,
  useTenantContext,
  useTenantFilter
} from './components/tenant';

// Re-export types for better TypeScript support and documentation
export type { LoaderProps } from './components/Loader';
export type { ErrorPageProps } from './components/ErrorPage';
export type { AppErrorBoundaryProps } from './components/AppErrorBoundary';
export type { UnauthorizedPageProps } from './components/UnauthorizedPage';
export type { ProtectedRouteProps, ProtectedRouteAuthService } from './components/ProtectedRoute';
export type { LoginButtonProps } from './components/LoginButton';
export type { NotificationsMenuProps } from './components/NotificationsMenu/NotificationsMenu';
export type {
  AuthHeaderProps,
  AuthHeaderUser,
  AuthHeaderNavigationItem,
  AuthHeaderTenantOption,
  AuthHeaderTenantSelectorProps
} from './components/AuthHeader';
export type { TenantOption, TenantSelectorProps, UseTenantResult } from './components/tenant';
export type { UsageMeterProps, UseEntitlementsResult } from './components/UsageMeter';

// Config provider factory
export { createConfigProvider } from './config/createConfigProvider';
export type { CreateConfigProviderOptions } from './config/createConfigProvider';

// Shell/iframe routing bridge: the shell owns the URL, embedded children run
// headless on a MemoryRouter and sync their location over postMessage.
export {
  EmbeddedRouter,
  useShellBridge,
  EMBED_FLAG,
  EMBED_PATH,
  buildEmbeddedUrl,
  extractChildPath,
  joinShellPath,
  normalizeEmbedPath,
  readEmbedContext,
  safeUrl,
  toOrigin,
  APP_SOURCE,
  SHELL_SOURCE,
  isAppAuthRequestMessage,
  isAppLocationMessage,
  isNavigateTopMessage,
  isShellNavigateMessage
} from './routing';
export type {
  EmbeddedRouterProps,
  ShellBridgeOptions,
  EmbedContext,
  AppAuthRequestMessage,
  AppLocationMessage,
  NavigateTopMessage,
  ShellAuthMessage,
  ShellNavigateMessage
} from './routing';
