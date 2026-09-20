// @tumbaland/frontend-core — everything the Tumbaland frontends share:
// the headless auth/group/API-client logic, and the React components and theme
// built on top of it.
//
// These were two packages, @tumbaland/frontend-core and @tumbaland/frontend-core,
// and every one of the eight frontends depended on both. Splitting them bought
// nothing a consumer could use and cost a release ordering problem: components
// pinned frontend-core exactly, so the two had to publish in dependency order
// or the published tarball pinned a version that was about to be replaced.
//
// The one thing the split did guarantee is kept by `./federation`: that entry
// point imports nothing, so the seven vite configs that read it in Node at
// build time never pull React in.

export { createApiClient, ApiError } from './apiClient';
export type { ApiClientOptions, ApiRequestOptions } from './apiClient';

export { createAuthService, createAppAuthService } from './authService';
export type { AuthServiceConfig, AuthService, AppAuthConfig } from './authService';

export { createGroupService } from './groupService';
export type { GroupServiceConfig, GroupService } from './groupService';

export { createEntitlementsService, isUnlimited, usageRatio, UNLIMITED } from './entitlementsService';
export type {
  EntitlementsServiceConfig,
  EntitlementsService,
  Entitlements,
  PlanLimits,
  MeterKey,
  FeatureKey
} from './entitlementsService';

export { createPlansService } from './plansService';
export type { CatalogPlan, PlansServiceConfig, PlansService } from './plansService';

export type { User, AuthResponse, Group, ApiResponse } from './types';

export { TENANT_STORAGE_KEY, clearSessionScopedStorage } from './sessionStorage';

// Monitoring: headless logging, error capture, correlation IDs, and web-vitals
export {
  initMonitoring,
  captureException,
  captureMessage,
  setUser,
  setTag,
  startTransaction,
  recordMetric,
  initWebVitals,
  flushLogs,
  initConsoleInterception,
  generateCorrelationId,
  getCorrelationId,
  getSessionId,
  logger
} from './monitoring';
export type { MonitoringConfig } from './monitoring';

// --- Components, theme and providers (formerly @tumbaland/frontend-core) ---

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
