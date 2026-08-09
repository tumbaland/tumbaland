import { Request } from 'express';
import { QueryFilter } from 'mongoose';
import {
  consumeQuota,
  getEntitlements,
  getGroupOwner,
  logger,
  releaseQuota
} from '@tumbaland/backend-core';
import TrackedTicker, { ITrackedTicker } from '../models/TrackedTicker';

/**
 * The `trackedTickers` chokepoint (MONETIZATION.md, Phase 3 #3).
 *
 * **Why this is not `requireQuota` on the route.** The meter counts *distinct
 * active symbols*, not rows — the Alpha Vantage spend it recovers is one call
 * per symbol per day however many rows hold it — so whether a write costs a
 * slot depends on what the subject already tracks. That is a database question,
 * and a generic middleware cannot ask it. Two consequences follow: adding a
 * symbol a group already follows is free rather than refused at the ceiling,
 * and the same primitives serve the *other* creation path — `createHolding`
 * tracks its ticker automatically, so a gate that only guarded
 * `POST /tracked-tickers` would be bypassed by adding a holding.
 *
 * Reserve happens before the write and rolls back if the write fails; release
 * happens after, once the collection reflects the new state.
 */

const METER = 'trackedTickers' as const;

/** Who a write bills to, and what it can see. Assembled from the request. */
export interface TickerActor {
  /** The meter's `subjectId` is an email, never `req.user.id`. */
  email?: string;
  /** `req.user.id` — what `TrackedTicker.userId` holds. */
  userId: string;
  /** `req.userGroups`: the groups the caller belongs to. */
  groups: string[];
  /** Attached to the `entitlement.blocked` log so a 402 traces back to a route. */
  route?: string;
}

/** What makes a row billable: which symbol, in whose scope, and whether it is live. */
export interface TickerIdentity {
  ticker: string;
  groupId?: string;
  /** Paused tickers are not fetched daily, so they are not counted. */
  isActive?: boolean;
}

/** Rollback handle for a write that reserved nothing. */
const NOTHING_RESERVED = async (): Promise<void> => {};

export function tickerActor(req: Request): TickerActor {
  return {
    email: req.user?.email,
    userId: req.user?.id ?? '',
    groups: req.userGroups ?? [],
    route: req.originalUrl
  };
}

interface BillingScope {
  /** The email the meter is kept under. */
  subject: string;
  /** Filters, OR'd, matching the rows we know bill to `subject`. */
  scopes: QueryFilter<ITrackedTicker>[];
}

async function ownerOf(groupId: string): Promise<string | undefined> {
  const owner = await getGroupOwner(groupId).catch(() => null);
  return owner?.ownerEmail;
}

async function groupsOwnedByCaller(actor: TickerActor, caller: string): Promise<string[]> {
  const resolved = await Promise.all(
    actor.groups.map(async id => ((await ownerOf(id)) === caller ? id : undefined))
  );
  return resolved.filter((id): id is string => Boolean(id));
}

/**
 * Who pays for a row in this scope, plus every scope we can see that bills to
 * the same person — which is what makes the distinct-symbol count possible
 * without a full aggregation.
 *
 * A group row bills to the group's owner (Family sells a *pooled* allowance, and
 * the uploader's own free tier is not the pool); a personal row bills to the
 * caller. When the subject is the caller we can also see their personal rows and
 * the groups they own, so a symbol held twice across those scopes is charged
 * once, exactly as the nightly reconciliation counts it.
 *
 * What we cannot see is the *other* scopes of a group owner who is not the
 * caller: a member adding a symbol the owner already tracks personally will
 * charge a slot the reconciliation later gives back. That is a bounded
 * over-count on a derived meter, which is precisely the drift reconciliation
 * exists to absorb — closing it would need an internal "groups owned by X"
 * lookup plus an email→userId one, for a case that costs at most one slot.
 *
 * An unresolvable group owner bills the caller and logs, matching
 * `groupOwnerSubject`: refusing the write would be harsher than what the
 * entitlement client itself does for the same outage, and the common case (a
 * member on a cheap plan writing into a Family group) then checks against the
 * *smaller* allowance.
 */
export async function resolveTickerScope(
  actor: TickerActor,
  groupId?: string
): Promise<BillingScope | null> {
  const caller = actor.email?.trim().toLowerCase();
  let subject = caller;

  if (groupId) {
    const owner = await ownerOf(groupId);
    if (owner) {
      subject = owner;
    } else {
      logger.error('Group owner unresolved; billing tracked ticker to the caller instead', {
        event: 'entitlement.subject_fallback',
        groupId,
        caller,
        route: actor.route
      });
    }
  }

  if (!subject) {
    // Behind `authenticateToken` this cannot happen; if it ever does, metering
    // a write to nobody is worse than not metering it, so say so loudly.
    logger.error('Tracked ticker write has no billable subject', {
      event: 'entitlement.subject_missing',
      userId: actor.userId,
      route: actor.route
    });
    return null;
  }

  const scopes: QueryFilter<ITrackedTicker>[] = [];
  if (groupId) scopes.push({ groupId });
  if (subject === caller) {
    // `groupId: null` matches missing as well as null, which is how personal
    // rows are stored.
    scopes.push({ userId: actor.userId, groupId: null });
    for (const owned of await groupsOwnedByCaller(actor, caller)) {
      if (owned !== groupId) scopes.push({ groupId: owned });
    }
  }

  return { subject, scopes };
}

async function alreadyCounted(scope: BillingScope, ticker: string, excludeId?: string): Promise<boolean> {
  const filter: QueryFilter<ITrackedTicker> = { ticker, isActive: true, $or: scope.scopes };
  if (excludeId) filter._id = { $ne: excludeId };
  return Boolean(await TrackedTicker.exists(filter));
}

/**
 * Reserve a slot for a symbol about to be tracked, returning the rollback for
 * the write that follows. A symbol the subject already tracks costs nothing.
 *
 * Uses `consumeQuota` rather than a read-then-write check so the loser of two
 * concurrent adds at the ceiling is the one rejected, and throws
 * `PaymentRequiredError` (402) when the reservation would overrun.
 */
export async function reserveTickerSlot(
  actor: TickerActor,
  target: TickerIdentity,
  options: { excludeId?: string } = {}
): Promise<() => Promise<void>> {
  if (target.isActive === false) return NOTHING_RESERVED;

  const scope = await resolveTickerScope(actor, target.groupId);
  if (!scope) return NOTHING_RESERVED;
  if (await alreadyCounted(scope, target.ticker, options.excludeId)) return NOTHING_RESERVED;

  const entitlements = await getEntitlements(scope.subject);
  await consumeQuota({
    subjectId: scope.subject,
    meter: METER,
    amount: 1,
    entitlements,
    route: actor.route
  });

  return () => releaseQuota(scope.subject, METER, 1);
}

/** Reserve, write, and hand the slot back if the write fails. */
export async function withTickerSlot<T>(
  actor: TickerActor,
  target: TickerIdentity,
  write: () => Promise<T>
): Promise<T> {
  const rollback = await reserveTickerSlot(actor, target);
  try {
    return await write();
  } catch (err) {
    await rollback();
    throw err;
  }
}

/**
 * Hand a slot back once a row has stopped counting — deleted, paused or moved.
 *
 * Call this *after* the write: it asks whether anything still covers the
 * symbol, so a second row in the same scope keeps the slot held.
 */
export async function releaseTickerSlot(actor: TickerActor, target: TickerIdentity): Promise<void> {
  if (target.isActive === false) return;

  const scope = await resolveTickerScope(actor, target.groupId);
  if (!scope) return;
  if (await alreadyCounted(scope, target.ticker)) return;

  await releaseQuota(scope.subject, METER, 1);
}

/**
 * Apply an update, keeping the meter in step with the row's billable identity.
 *
 * An edit can change the symbol, move the row between groups, or pause it — each
 * of which can shift a slot from one subject to another. The new identity is
 * reserved before the write (so an update that would overrun is refused without
 * touching the row) and the old one released after it, once the collection shows
 * the new state.
 */
export async function withTickerUpdate<T>(
  actor: TickerActor,
  before: (TickerIdentity & { id: string }) | null,
  changes: Partial<TickerIdentity>,
  write: () => Promise<T>
): Promise<T> {
  if (!before) return write();

  const after: TickerIdentity = {
    ticker: changes.ticker ?? before.ticker,
    groupId: changes.groupId ?? before.groupId,
    isActive: changes.isActive ?? before.isActive
  };

  const unchanged =
    after.ticker === before.ticker &&
    after.groupId === before.groupId &&
    after.isActive === before.isActive;
  if (unchanged) return write();

  // Excluding the row itself: it still holds its *old* identity until the write
  // lands, and must not be read as covering the new one.
  const rollback = await reserveTickerSlot(actor, after, { excludeId: before.id });

  let result: T;
  try {
    result = await write();
  } catch (err) {
    await rollback();
    throw err;
  }

  await releaseTickerSlot(actor, before);
  return result;
}
