import { Request, RequestHandler } from 'express';
import logger from '../logging/logger';
import { PaymentRequiredError, UnauthorizedError } from '../errors/HttpError';
import { FeatureKey, MeterKey, UNLIMITED } from './definitions';
import { getEntitlements } from './client';
import { checkQuota } from './usage';
import { getEntitlementsMode } from './mode';
import { Entitlements } from './types';

declare global {
  namespace Express {
    interface Request {
      /** Populated by the entitlement middlewares so controllers can read limits without a second lookup. */
      entitlements?: Entitlements;
    }
  }
}

/**
 * Who the check is billed to. Defaults to the authenticated user; group
 * chokepoints override it with the group owner, since pooled quota belongs to
 * whoever pays for the group.
 */
export type SubjectResolver = (req: Request) => string | undefined | Promise<string | undefined>;

export interface EntitlementOptions {
  subject?: SubjectResolver;
}

const defaultSubject: SubjectResolver = req => req.user?.email;

/**
 * Resolves and caches entitlements on the request. Two checks on one route
 * (a feature gate plus a quota gate) therefore cost one lookup, not two.
 */
export async function loadEntitlements(req: Request, resolve: SubjectResolver = defaultSubject): Promise<Entitlements> {
  if (req.entitlements) return req.entitlements;

  const subject = await resolve(req);
  if (!subject) throw new UnauthorizedError('Authentication required');

  const entitlements = await getEntitlements(subject);
  req.entitlements = entitlements;
  return entitlements;
}

/**
 * Gate a feature flag. Reads are never gated by design — use this on writes,
 * dispatches and exports only.
 */
export function requireEntitlement(feature: FeatureKey, options: EntitlementOptions = {}): RequestHandler {
  return async (req, _res, next) => {
    try {
      const mode = getEntitlementsMode();
      if (mode === 'off') return next();

      const entitlements = await loadEntitlements(req, options.subject);
      if (entitlements.limits.features[feature]) return next();

      if (mode === 'observe') {
        logger.info('entitlement.would_block', {
          event: 'entitlement.would_block',
          feature,
          subjectId: entitlements.email,
          planCode: entitlements.planCode,
          route: req.originalUrl,
          stale: entitlements.stale === true
        });
        return next();
      }

      throw new PaymentRequiredError(`Your plan does not include ${feature}`, {
        code: 'FEATURE_NOT_IN_PLAN',
        feature,
        planCode: entitlements.planCode,
        upgradeTo: entitlements.upgradeTo
      });
    } catch (err) {
      next(err);
    }
  };
}

export interface QuotaOptions extends EntitlementOptions {
  /**
   * How much this request costs. A function when the amount is in the payload
   * — an upload's `sizeBytes`, say — which is also why the storage gate sits on
   * the signed-URL request: it is the only point where the size is known
   * *before* the bytes are written.
   */
  amount?: number | ((req: Request) => number);
}

/**
 * Read-only quota gate. Records nothing — the increment belongs at the point
 * the resource actually comes into existence, via `consumeQuota`.
 */
export function requireQuota(meter: MeterKey, options: QuotaOptions = {}): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (getEntitlementsMode() === 'off') return next();

      const entitlements = await loadEntitlements(req, options.subject);
      const amount = typeof options.amount === 'function' ? options.amount(req) : (options.amount ?? 1);

      await checkQuota({
        subjectId: entitlements.email,
        meter,
        amount,
        entitlements,
        route: req.originalUrl
      });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * The oldest timestamp a user may read, or `null` for unlimited history.
 *
 * Meant to be dropped straight into an aggregation `$match` — this is what
 * gates the portfolio planner, since the planner runs entirely client-side and
 * any `<PaywallGate>` around it is bypassable from devtools. Truncating the
 * price history it depends on is not.
 */
export async function retentionFloor(email: string, now: Date = new Date()): Promise<Date | null> {
  if (getEntitlementsMode() !== 'enforce') return null;

  const { limits } = await getEntitlements(email);
  const days = limits.retentionDays;
  if (days === UNLIMITED || days < 0) return null;

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
