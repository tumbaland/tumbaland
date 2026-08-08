import logger from '../logging/logger';
import { EntitlementsMode } from './types';

const VALID_MODES: readonly EntitlementsMode[] = ['off', 'observe', 'enforce'];

let warnedAboutInvalidMode = false;

/**
 * Read per call rather than cached at import time: a service can be flipped to
 * `enforce` by restarting it with a new env value, and tests set the variable
 * between cases. The cost is one `process.env` lookup per check.
 */
export function getEntitlementsMode(): EntitlementsMode {
  const raw = (process.env.ENTITLEMENTS_MODE || '').trim().toLowerCase();
  if (!raw) return 'observe';
  if ((VALID_MODES as readonly string[]).includes(raw)) return raw as EntitlementsMode;

  if (!warnedAboutInvalidMode) {
    warnedAboutInvalidMode = true;
    logger.warn('Invalid ENTITLEMENTS_MODE, falling back to observe', { value: raw });
  }
  return 'observe';
}

/** Test seam — the "already warned" latch would otherwise leak between cases. */
export function resetEntitlementsModeWarning(): void {
  warnedAboutInvalidMode = false;
}
