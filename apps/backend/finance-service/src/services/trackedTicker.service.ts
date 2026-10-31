import TrackedTicker from '../models/TrackedTicker';
import Holding from '../models/Holding';
import Trade from '../models/Trade';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { canAccessResource, ConflictError, ForbiddenError, NotFoundError, assertMemberOf } from '@tumbaland/backend-core';
import { scopeFor } from '../utils/scope';

export const getAllTrackedTickers = async (userId: string, userGroups: string[] = []) => {
  if (userGroups.length === 0) {
    // Personal context: only personal tickers (no groupId)
    return TrackedTicker.find({ 
      userId,
      $or: [
        { groupId: { $exists: false } },
        { groupId: null }
      ]
    }).sort({ ticker: 1 });
  } else {
    // Group context: only group tickers
    return TrackedTicker.find({ 
      groupId: { $in: userGroups }
    }).sort({ ticker: 1 });
  }
};

/**
 * The raw row, for the usage sync to compare a pending update against.
 *
 * No permission check, deliberately: nothing here reaches the caller — the
 * update it precedes does its own authorization and refuses before anything is
 * written.
 */
export const getTrackedTickerById = async (id: string) => TrackedTicker.findById(id);

export const createTrackedTicker = async (
  data: {
    ticker: string;
    displayName: string;
    description?: string;
    currency?: string;
    isin?: string;
    isActive?: boolean;
    groupId?: string;
  },
  userId: string,
  userGroups: string[] = []
) => {
  // If groupId is provided, verify user has access to that group
  assertMemberOf(data.groupId, userGroups);
  
  const tracked = new TrackedTicker({
    ...data,
    userId,
    dateAdded: new Date(),
    isActive: data.isActive !== undefined ? data.isActive : true
  });
  return tracked.save();
};

export const updateTrackedTicker = async (
  id: string,
  data: {
    ticker?: string;
    displayName?: string;
    description?: string;
    currency?: string;
    isin?: string;
    isActive?: boolean;
    groupId?: string;
  },
  userId: string,
  userGroups: string[] = []
) => {
  // First check if user has access to this ticker
  const existingTicker = await TrackedTicker.findById(id);
  if (!existingTicker) {
    return null;
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingTicker.userId || '',
    existingTicker.groupId,
    userGroups,
    false // tickers are not public
  );

  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  // If groupId is being updated, verify user has access to the new group
  assertMemberOf(data.groupId, userGroups);

  if (data.ticker !== undefined && data.ticker !== existingTicker.ticker) {
    await renameSymbol(existingTicker.ticker, data.ticker, scopeFor(existingTicker.userId, existingTicker.groupId));
  }

  return TrackedTicker.findByIdAndUpdate(id, data, { new: true });
};

/**
 * Carry everything keyed by the old symbol over to the new one.
 *
 * A symbol is the foreign key between a tracked ticker, its price rows and the
 * holdings and trades valued against them, so changing it on the ticker alone
 * leaves all three pointing at a symbol nothing tracks: the history drops out
 * of every chart and the holding stops pricing. That is how 5,612 closes went
 * missing when tickers were re-added under Alpha Vantage's exchange suffix
 * (`VUSA.DE` → `VUSA.DEX`) in June 2026.
 *
 * Price rows are copied, not moved: they are shared by every account tracking
 * the symbol, and another account may still follow the old one. Where the new
 * symbol already holds a close for the same session, that row wins, because it
 * is what the provider serves now. Holdings and trades belong to the owner, so
 * they are re-pointed in place, within the ticker's own scope.
 *
 * Refuses a symbol the scope already tracks or holds: folding two positions
 * into one is a decision about quantities, not something to do on a rename.
 *
 * Runs before the ticker row is renamed and every step is idempotent, so a
 * failure part-way leaves the old symbol on the ticker and a retry finishes.
 */
async function renameSymbol(from: string, to: string, scope: Record<string, unknown>): Promise<void> {
  const [tracked, held] = await Promise.all([
    TrackedTicker.exists({ ...scope, ticker: to }),
    Holding.exists({ ...scope, ticker: to })
  ]);
  if (tracked || held) {
    throw new ConflictError(`${to} is already tracked or held here. Remove it first, then rename ${from}.`);
  }

  await TickerPriceHistory.aggregate([
    { $match: { ticker: from } },
    { $project: { _id: 0 } },
    // `on` fields may not be missing, and rows written before `interval`
    // existed carry none; those are daily closes.
    { $set: { ticker: to, interval: { $ifNull: ['$interval', 'daily'] } } },
    {
      $merge: {
        into: TickerPriceHistory.collection.collectionName,
        on: ['ticker', 'interval', 'date'],
        whenMatched: 'keepExisting',
        whenNotMatched: 'insert'
      }
    }
  ]);

  await Holding.updateMany({ ...scope, ticker: from }, { $set: { ticker: to } });
  await Trade.updateMany({ ...scope, ticker: from }, { $set: { ticker: to } });
}

export const deleteTrackedTicker = async (id: string, userId: string, userGroups: string[] = []) => {
  // First check if user has access to this ticker
  const existingTicker = await TrackedTicker.findById(id);
  if (!existingTicker) {
    throw new NotFoundError('Ticker not found');
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingTicker.userId || '',
    existingTicker.groupId,
    userGroups,
    false // tickers are not public
  );

  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  return TrackedTicker.findByIdAndDelete(id);
};
