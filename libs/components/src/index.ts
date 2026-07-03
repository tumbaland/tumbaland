export { Loader } from './components/Loader';
export { ErrorPage } from './components/ErrorPage';
export { UnauthorizedPage } from './components/UnauthorizedPage';
export { LoginButton } from './components/LoginButton';
export { NotificationsMenu } from './components/NotificationsMenu/NotificationsMenu';
export { AuthHeader } from './components/AuthHeader';

// Re-export types for better TypeScript support and documentation
export type { LoaderProps } from './components/Loader';
export type { ErrorPageProps } from './components/ErrorPage';
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

// Monitoring
export {
  initMonitoring,
  captureException,
  captureMessage,
  setUser,
  setTag,
  recordMetric,
  initWebVitals,
  generateCorrelationId,
  getCorrelationId,
  getSessionId
} from './monitoring';
