import UserPortfolio from '../models/UserPortfolio';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

export const getAllUserPortfolios = async (userId: string, userGroups: string[] = []) => {
  let portfolios;
  if (userGroups.length === 0) {
    // Personal context: only personal portfolios (no groupId)
    portfolios = await UserPortfolio.find({ 
      userId,
      $or: [
        { groupId: { $exists: false } },
        { groupId: null }
      ]
    }).sort({ symbol: 1 });
  } else {
    // Group context: only group portfolios
    portfolios = await UserPortfolio.find({ 
      groupId: { $in: userGroups }
    }).sort({ symbol: 1 });
  }
  // Fetch latest price for each ticker
  const tickers = portfolios.map((p) => p.symbol);
  // Get latest price for each ticker
  const latestPrices = await TickerPriceHistory.aggregate([
    { $match: { ticker: { $in: tickers } } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: '$ticker',
        latestPrice: { $first: '$price' }
      }
    }
  ]);
  // Get ATH (all-time high) price for each ticker
  const athPrices = await TickerPriceHistory.aggregate([
    { $match: { ticker: { $in: tickers } } },
    {
      $group: {
        _id: '$ticker',
        athPrice: { $max: '$price' }
      }
    }
  ]);
  const priceMap = Object.fromEntries(latestPrices.map((p) => [p._id, p.latestPrice]));
  const athMap = Object.fromEntries(athPrices.map((p) => [p._id, p.athPrice]));
  // Attach latest price, ATH price, value increase, percent increase
  return portfolios.map((p) => {
    const latestPrice = priceMap[p.symbol];
    const athPrice = athMap[p.symbol];
    const currentValue = latestPrice !== undefined ? latestPrice * p.quantity : undefined;
    const valueIncrease = latestPrice !== undefined ? (latestPrice - p.avgBuyPrice) * p.quantity : undefined;
    const percentIncrease =
      latestPrice !== undefined ? ((latestPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : undefined;
    return {
      ...p.toObject(),
      latestPrice,
      athPrice,
      currentValue,
      valueIncrease,
      percentIncrease
    };
  });
};

export const createUserPortfolio = async (
  data: {
    symbol: string;
    quantity: number;
    avgBuyPrice: number;
    buyDate?: Date;
    notes?: string;
    groupId?: string;
  },
  userId: string,
  userGroups: string[] = []
) => {
  // Add userId to the data
  const portfolioData = {
    ...data,
    userId
  };
  
  // If groupId is provided, verify user has access to that group
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new Error('ACCESS_DENIED');
  }
  
  const portfolio = new UserPortfolio(portfolioData);
  return portfolio.save();
};

export const updateUserPortfolio = async (
  id: string,
  data: { symbol?: string; quantity?: number; avgBuyPrice?: number; buyDate?: Date; notes?: string; groupId?: string },
  userId: string,
  userGroups: string[] = []
) => {
  // First check if user has access to this portfolio
  const existingPortfolio = await UserPortfolio.findById(id);
  if (!existingPortfolio) {
    return null;
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingPortfolio.userId || '',
    existingPortfolio.groupId,
    userGroups,
    false // portfolios are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  // If groupId is being updated, verify user has access to the new group
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new Error('ACCESS_DENIED');
  }

  return UserPortfolio.findByIdAndUpdate(id, data, { new: true });
};

export const deleteUserPortfolio = async (id: string, userId: string, userGroups: string[] = []) => {
  // First check if user has access to this portfolio
  const existingPortfolio = await UserPortfolio.findById(id);
  if (!existingPortfolio) {
    throw new Error('Portfolio not found');
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingPortfolio.userId || '',
    existingPortfolio.groupId,
    userGroups,
    false // portfolios are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  return UserPortfolio.findByIdAndDelete(id);
};
