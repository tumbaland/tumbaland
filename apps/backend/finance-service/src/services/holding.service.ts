import Holding from '../models/Holding';
import TrackedTicker from '../models/TrackedTicker';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { canAccessResource, ForbiddenError, NotFoundError, assertMemberOf } from '@tumbaland/backend-core';
import { BASE_CURRENCY, getRates } from './fxRate.service';
import { getPositions } from './trade.service';
import { EMPTY_POSITION } from './position.service';

export interface HoldingInput {
  ticker: string;
  displayName?: string;
  currency?: string;
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
  const currencyMap = new Map(
    trackedTickers.filter((t) => t.currency).map((t) => [t.ticker, t.currency as string])
  );

  // Prices and buy prices are in the instrument's own currency; every monetary
  // total below is in the base currency, so they can be summed with each other
  // and with net-worth values.
  const rates = await getRates([...currencyMap.values()], BASE_CURRENCY);

  // Realized P/L and dividends only exist for tickers with a trade log; a
  // holding entered by hand simply has no history to derive them from.
  const positions = await getPositions(userId, userGroups);

  return holdings.map((h) => {
    const stats = statsMap.get(h.ticker);
    const latestPrice = stats?.latestPrice;

    // No recorded currency means the ticker predates the field; treat it as
    // already being in the base currency rather than guessing at a conversion.
    const currency = currencyMap.get(h.ticker) || BASE_CURRENCY;
    const fxRate = currency === BASE_CURRENCY ? 1 : rates.get(currency);
    const convert = (value: number) => (fxRate === undefined ? undefined : value * fxRate);

    const currentValue = latestPrice !== undefined ? convert(latestPrice * h.quantity) : undefined;
    const costBasis = convert(h.avgBuyPrice * h.quantity);
    const valueIncrease =
      latestPrice !== undefined ? convert((latestPrice - h.avgBuyPrice) * h.quantity) : undefined;
    // A ratio of two amounts in the same currency — no conversion needed, and
    // still meaningful when the FX rate is missing.
    const percentIncrease =
      latestPrice !== undefined ? ((latestPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100 : undefined;

    const position = positions.get(h.ticker) || EMPTY_POSITION;

    return {
      ...h.toObject(),
      displayName: nameMap.get(h.ticker),
      currency,
      baseCurrency: BASE_CURRENCY,
      fxRate,
      // Derived from the trade log, in base currency, and zero for holdings
      // that have none.
      realizedGain: convert(position.realizedGain) ?? 0,
      dividends: convert(position.dividends) ?? 0,
      tradeFees: convert(position.fees) ?? 0,
      tradeCount: position.tradeCount,
      // Set when the instrument is quoted in a currency we have no rate for:
      // its value is left out of the totals rather than silently miscounted.
      missingFxRate: fxRate === undefined,
      latestPrice,
      latestPriceDate: stats?.latestPriceDate,
      athPrice: stats?.athPrice,
      costBasis,
      currentValue,
      valueIncrease,
      percentIncrease
    };
  });
};

export const createHolding = async (data: HoldingInput, userId: string, userGroups: string[] = []) => {
  assertMemberOf(data.groupId, userGroups);

  const { displayName, currency, ...holdingData } = data;
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
      ...(currency ? { currency } : {}),
      userId,
      ...(data.groupId ? { groupId: data.groupId } : {}),
      isActive: true
    }).save();
  } else {
    let changed = false;
    // Backfill the currency onto a ticker tracked before the field existed, so
    // the first holding added from search fixes the conversion for everyone.
    if (currency && !existing.currency) {
      existing.currency = currency;
      changed = true;
    }
    if (!existing.isActive) {
      existing.isActive = true;
      changed = true;
    }
    if (changed) await existing.save();
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

  assertMemberOf(data.groupId, userGroups);

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
