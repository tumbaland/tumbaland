export { Loader } from './components/Loader';
export { ErrorPage } from './components/ErrorPage';
export { AppErrorBoundary } from './components/AppErrorBoundary';
export { UnauthorizedPage } from './components/UnauthorizedPage';
export { LoginButton } from './components/LoginButton';
export { NotificationsMenu } from './components/NotificationsMenu/NotificationsMenu';
export { AuthHeader } from './components/AuthHeader';

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

// Config provider factory
export { createConfigProvider } from './config/createConfigProvider';
export type { CreateConfigProviderOptions } from './config/createConfigProvider';
