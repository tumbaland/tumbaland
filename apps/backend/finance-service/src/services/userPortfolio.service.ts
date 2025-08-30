import UserPortfolio from '../models/UserPortfolio';
import TickerPriceHistory from '../models/TickerPriceHistory';

export const getAllUserPortfolios = async () => {
  const portfolios = await UserPortfolio.find().sort({ symbol: 1 });
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

export const createUserPortfolio = async (data: {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: Date;
  notes?: string;
}) => {
  const portfolio = new UserPortfolio(data);
  return portfolio.save();
};

export const updateUserPortfolio = async (
  id: string,
  data: { symbol?: string; quantity?: number; avgBuyPrice?: number; buyDate?: Date; notes?: string }
) => {
  return UserPortfolio.findByIdAndUpdate(id, data, { new: true });
};

export const deleteUserPortfolio = async (id: string) => {
  return UserPortfolio.findByIdAndDelete(id);
};
