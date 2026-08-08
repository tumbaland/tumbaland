export {
  UNLIMITED,
  FALLBACK_PLAN,
  STAFF_PLAN,
  applyLimits,
  METER_KEYS,
  FEATURE_KEYS,
  METER_DEFINITIONS,
  FEATURE_DEFINITIONS,
  DEFAULT_PLAN_LIMITS,
  ENTITLEMENT_CATALOG,
  resolveLimits,
  normalizeLimits,
  meterPeriod,
  isMeterKey,
  isFeatureKey,
  fitsWithin
} from './definitions';
export type {
  MeterKey,
  FeatureKey,
  MeterPeriod,
  MeterDefinition,
  FeatureDefinition,
  PlanLimits,
  PartialPlanLimits
} from './definitions';

export type { Entitlements, EntitlementsMode } from './types';
export { getEntitlementsMode, resetEntitlementsModeWarning } from './mode';

export { UsageMeter, currentPeriod } from './UsageMeter';
export type { IUsageMeter } from './UsageMeter';
export { getUsage, getUsageSnapshot, checkQuota, consumeQuota, releaseQuota, setUsage } from './usage';
export type { QuotaRequest } from './usage';

export { getEntitlements, invalidateEntitlements, clearEntitlementsCache } from './client';

export { loadEntitlements, requireEntitlement, requireQuota, retentionFloor } from './middleware';
export type { EntitlementOptions, QuotaOptions, SubjectResolver } from './middleware';
