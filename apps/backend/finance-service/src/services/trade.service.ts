import Trade, { ITrade, TradeType } from '../models/Trade';
import Holding from '../models/Holding';
import { BadRequestError, ForbiddenError, NotFoundError, canAccessResource } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import { derivePosition, Position, EMPTY_POSITION } from './position.service';

export interface TradeInput {
  ticker: string;
  type: TradeType;
  date: Date;
  quantity?: number;
  price?: number;
  amount?: number;
  fees?: number;
  notes?: string;
  groupId?: string;
}

export const getTrades = async (userId: string, userGroups: string[] = [], ticker?: string) => {
  const filter = { ...tenantScope(userId, userGroups), ...(ticker ? { ticker: ticker.toUpperCase() } : {}) };
  return Trade.find(filter).sort({ date: -1, createdAt: -1 });
};

/** Every trade for one ticker in one context, oldest first — replay order. */
const tradesForTicker = async (ticker: string, userId: string, userGroups: string[]) =>
  Trade.find({ ...tenantScope(userId, userGroups), ticker: ticker.toUpperCase() }).sort({ date: 1 });

export const getPosition = async (
  ticker: string,
  userId: string,
  userGroups: string[] = []
): Promise<Position> => {
  const trades = await tradesForTicker(ticker, userId, userGroups);
  return trades.length === 0 ? EMPTY_POSITION : derivePosition(trades);
};

/** Positions for every ticker traded in this context, keyed by ticker. */
export const getPositions = async (
  userId: string,
  userGroups: string[] = []
): Promise<Map<string, Position>> => {
  const trades = await Trade.find(tenantScope(userId, userGroups)).sort({ date: 1 });

  const byTicker = new Map<string, ITrade[]>();
  for (const trade of trades) {
    const existing = byTicker.get(trade.ticker);
    if (existing) existing.push(trade);
    else byTicker.set(trade.ticker, [trade]);
  }

  const positions = new Map<string, Position>();
  byTicker.forEach((tickerTrades, ticker) => positions.set(ticker, derivePosition(tickerTrades)));
  return positions;
};

/**
 * Push the replayed position onto the matching `Holding`, which is a
 * materialized view of the trade log rather than an independent record.
 *
 * Holdings that predate the trade log have no trades and keep whatever was
 * entered by hand; only once a ticker has trades does the log become the source
 * of truth for it. A position closed out to zero deletes the holding, since
 * carrying a zero-quantity row would sit in the portfolio forever.
 */
export const syncHoldingFromTrades = async (
  ticker: string,
  userId: string,
  userGroups: string[] = [],
  groupId?: string
): Promise<void> => {
  const position = await getPosition(ticker, userId, userGroups);
  const scope = { ...tenantScope(userId, userGroups), ticker: ticker.toUpperCase() };
  const existing = await Holding.findOne(scope);

  if (position.tradeCount === 0) return;

  if (position.quantity <= 0) {
    if (existing) await Holding.findByIdAndDelete(existing._id);
    return;
  }

  if (existing) {
    existing.quantity = position.quantity;
    existing.avgBuyPrice = position.avgBuyPrice;
    await existing.save();
    return;
  }

  await new Holding({
    ticker: ticker.toUpperCase(),
    quantity: position.quantity,
    avgBuyPrice: position.avgBuyPrice,
    userId,
    ...(groupId ? { groupId } : {})
  }).save();
};

/** Reject the combinations the schema alone cannot express. */
function assertConsistent(data: Partial<TradeInput>, type: TradeType): void {
  if (type === 'buy' || type === 'sell') {
    if (!data.quantity || data.quantity <= 0) {
      throw new BadRequestError(`A ${type} needs a quantity greater than zero`);
    }
    if (data.price === undefined || data.price < 0) {
      throw new BadRequestError(`A ${type} needs a price`);
    }
    return;
  }

  if (!data.amount || data.amount <= 0) {
    throw new BadRequestError(`A ${type} needs an amount greater than zero`);
  }
}

export const createTrade = async (data: TradeInput, userId: string, userGroups: string[] = []) => {
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  assertConsistent(data, data.type);

  const trade = await new Trade({
    ...data,
    ticker: data.ticker.toUpperCase(),
    quantity: data.quantity || 0,
    price: data.price || 0,
    amount: data.amount || 0,
    fees: data.fees || 0,
    userId
  }).save();

  await syncHoldingFromTrades(data.ticker, userId, userGroups, data.groupId);

  return trade;
};

export const updateTrade = async (
  id: string,
  data: Partial<TradeInput>,
  userId: string,
  userGroups: string[] = []
) => {
  const existing = await Trade.findById(id);
  if (!existing) {
    throw new NotFoundError('Trade not found');
  }

  if (!canAccessResource(userId, existing.userId, existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  const type = (data.type || existing.type) as TradeType;
  assertConsistent({ ...existing.toObject(), ...data }, type);

  const updated = await Trade.findByIdAndUpdate(
    id,
    { ...data, ...(data.ticker ? { ticker: data.ticker.toUpperCase() } : {}) },
    { new: true }
  );

  // An edit that moves a trade to a different ticker changes two positions.
  await syncHoldingFromTrades(existing.ticker, userId, userGroups, existing.groupId);
  if (data.ticker && data.ticker.toUpperCase() !== existing.ticker) {
    await syncHoldingFromTrades(data.ticker, userId, userGroups, existing.groupId);
  }

  return updated;
};

export const deleteTrade = async (id: string, userId: string, userGroups: string[] = []) => {
  const existing = await Trade.findById(id);
  if (!existing) {
    throw new NotFoundError('Trade not found');
  }

  if (!canAccessResource(userId, existing.userId, existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }

  await Trade.findByIdAndDelete(id);
  await syncHoldingFromTrades(existing.ticker, userId, userGroups, existing.groupId);

  return existing;
};
