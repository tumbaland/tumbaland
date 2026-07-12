import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { canAccessResource } from '../utils/permissionUtils';
import { ForbiddenError, NotFoundError } from '@tumbaland/backend-core';

export interface HoldingInput {
  ticker: string;
  displayName?: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: Date;
  notes?: string;
  groupId?: string;
}

export const getAllHoldings = async (userId: string, userGroups: string[] = []) => {
  let holdings;
  if (userGroups.length === 0) {
    // Personal context: only personal holdings (no groupId)
    holdings = await Holding.find({
      userId,
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    }).sort({ ticker: 1 });
  } else {
    // Group context: only group holdings
    holdings = await Holding.find({ groupId: { $in: userGroups } }).sort({ ticker: 1 });
  }

  const tickers = holdings.map((h) => h.ticker);

  // Latest and all-time-high price per ticker in one aggregation
  const priceStats = await TickerPriceHistory.aggregate([
    { $match: { ticker: { $in: tickers } } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: '$ticker',
        latestPrice: { $first: '$price' },
        latestPriceDate: { $first: '$date' },
        athPrice: { $max: '$price' }
      }
    }
  ]);
  const statsMap = new Map(priceStats.map((p) => [p._id, p]));

  const trackedTickers = await TrackedTicker.find({ ticker: { $in: tickers } });
  const nameMap = new Map(trackedTickers.map((t) => [t.ticker, t.displayName]));

  return holdings.map((h) => {
    const stats = statsMap.get(h.ticker);
    const latestPrice = stats?.latestPrice;
    const currentValue = latestPrice !== undefined ? latestPrice * h.quantity : undefined;
    const valueIncrease = latestPrice !== undefined ? (latestPrice - h.avgBuyPrice) * h.quantity : undefined;
    const percentIncrease =
      latestPrice !== undefined ? ((latestPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100 : undefined;
    return {
      ...h.toObject(),
      displayName: nameMap.get(h.ticker),
      latestPrice,
      latestPriceDate: stats?.latestPriceDate,
      athPrice: stats?.athPrice,
      currentValue,
      valueIncrease,
      percentIncrease
    };
  });
};

export const createHolding = async (data: HoldingInput, userId: string, userGroups: string[] = []) => {
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const { displayName, ...holdingData } = data;
  const holding = await new Holding({ ...holdingData, userId }).save();

  // Track the ticker in the same context so the daily price job covers it
  const tickerScope = data.groupId
    ? { ticker: data.ticker, groupId: data.groupId }
    : { ticker: data.ticker, userId, groupId: { $exists: false } };
  const existing = await TrackedTicker.findOne(tickerScope);
  if (!existing) {
    await new TrackedTicker({
      ticker: data.ticker,
      displayName: displayName || data.ticker,
      userId,
      ...(data.groupId ? { groupId: data.groupId } : {}),
      isActive: true
    }).save();
  } else if (!existing.isActive) {
    existing.isActive = true;
    await existing.save();
  }

  return holding;
};

export const updateHolding = async (
  id: string,
  data: Partial<HoldingInput>,
  userId: string,
  userGroups: string[] = []
) => {
  const existing = await Holding.findById(id);
  if (!existing) {
    return null;
  }

  if (!canAccessResource(userId, existing.userId || '', existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  const { displayName: _displayName, ...holdingData } = data;
  return Holding.findByIdAndUpdate(id, holdingData, { new: true });
};

export const deleteHolding = async (id: string, userId: string, userGroups: string[] = []) => {
  const existing = await Holding.findById(id);
  if (!existing) {
    throw new NotFoundError('Holding not found');
  }

  if (!canAccessResource(userId, existing.userId || '', existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  return Holding.findByIdAndDelete(id);
};
