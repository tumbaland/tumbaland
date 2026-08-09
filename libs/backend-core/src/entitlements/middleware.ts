import { Request, RequestHandler } from 'express';
import logger from '../logging/logger';
import { PaymentRequiredError, UnauthorizedError } from '../errors/HttpError';
import { FALLBACK_PLAN, FeatureKey, MeterKey, UNLIMITED, resolveLimits } from './definitions';
import { getEntitlements } from './client';
import { checkQuota } from './usage';
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
      const entitlements = await loadEntitlements(req, options.subject);
      if (entitlements.limits.features[feature]) return next();

      logger.info('entitlement.blocked', {
        event: 'entitlement.blocked',
        feature,
        subjectId: entitlements.email,
        planCode: entitlements.planCode,
        route: req.originalUrl,
        stale: entitlements.stale === true
      });

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
 * The oldest timestamp a caller may read, or `null` for unlimited history.
 *
 * Meant to be dropped straight into a `$match` or a `find` filter — this is what
 * gates the portfolio planner, since the planner runs entirely client-side and
 * any `<PaywallGate>` around it is bypassable from devtools. Truncating the
 * price history it depends on is not.
 *
 * **Several subjects resolve to the most generous floor.** Retention is not a
 * counter, so unlike a quota it has no single payer: data held in a group is
 * read by every member, and if it resolved to the *caller's* plan alone, a free
 * member of a paid Family group would see ninety days of a household's history
 * that the household paid to keep. Pass the caller together with the owners of
 * the groups being read, and the group's plan lifts the floor for everyone in
 * it — which is what "shared across a household" was sold as.
 *
 * An empty list resolves to the free plan's floor rather than to `null`: no
 * identifiable subject must never mean unlimited history.
 */
export async function retentionFloor(
  subject: string | readonly string[],
  now: Date = new Date()
): Promise<Date | null> {
  const emails = (Array.isArray(subject) ? subject : [subject as string]).filter(Boolean);
  const floorFor = (days: number): Date | null =>
    days === UNLIMITED || days < 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  if (emails.length === 0) {
    return floorFor(resolveLimits(FALLBACK_PLAN).retentionDays);
  }

  const floors = await Promise.all(
    emails.map(async email => floorFor((await getEntitlements(email)).limits.retentionDays))
  );

  // `null` is unlimited, which beats every date; otherwise the earliest floor
  // is the one that reaches furthest back.
  if (floors.some(floor => floor === null)) return null;
  return (floors as Date[]).reduce((a, b) => (a < b ? a : b));
}
