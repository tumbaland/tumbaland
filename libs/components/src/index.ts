export { Loader } from './components/Loader';
export { ErrorPage } from './components/ErrorPage';
export { AppErrorBoundary } from './components/AppErrorBoundary';
export { UnauthorizedPage } from './components/UnauthorizedPage';
export { ProtectedRoute } from './components/ProtectedRoute';
export { LoginButton } from './components/LoginButton';
export { NotificationsMenu } from './components/NotificationsMenu/NotificationsMenu';
export { AuthHeader } from './components/AuthHeader';
export { AppLayout } from './components/AppLayout';

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
export type { AppLayoutProps } from './components/AppLayout';
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

// A plain URL helper; the iframe bridge it belonged to is gone (see routing/index).
export { toOrigin } from './routing';

// Theme: the palette, the MUI theme built from it, and the raw tokens for the
// places that have to name a colour outside a `sx` prop.
export {
  brand,
  ink,
  surface,
  gradient,
  moduleAccent,
  wordmark,
  glass,
  glassInteractive,
  brandButton,
  section,
  gutter,
  gutterSx,
  TOUCH_TARGET,
  PHONE,
  createTumbalandTheme,
  tumbalandTheme,
  TUMBALAND_COLORS
} from './theme';
