import cron from 'node-cron';
import { fetchStockPrice } from './yahooFinance.service';
import TickerPriceHistory from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';

export function startDailyPortfolioUpdate() {
  // Runs every day at 19:00 (7 PM)
  cron.schedule('0 19 * * *', async () => {
    try {
      // Fetch tracked tickers from DB
      const trackedTickers = await TrackedTicker.find();
      for (const tracked of trackedTickers) {
        const ticker = tracked.ticker;
        const price = await fetchStockPrice(ticker);
        if (price) {
          // Save each ticker's price to TickerPriceHistory
          await TickerPriceHistory.create({
            date: new Date(),
            ticker,
            price
          });
        }
      }
      console.log('Daily ticker prices updated');
    } catch (err) {
      console.error('Portfolio update failed:', err);
    }
  });
}
