// @tumbaland/frontend-core - Shared frontend auth/group/API-client logic

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
