import cron from 'node-cron';
import TickerPriceHistory from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';
import { fetchStockPrice } from './alphaVantage.service';

export function startDailyPortfolioUpdate() {
  // Runs every day at 19:00 (7 PM)
  cron.schedule('0 19 * * *', async () => {
    try {
      // Fetch tracked tickers from DB
      const trackedTickers = await TrackedTicker.find();
      for (const tracked of trackedTickers) {
        const ticker = tracked.ticker;
        const priceData = await fetchStockPrice(ticker);
        if (priceData) {
          // Normalize date to midnight UTC for both filter and update
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          await TickerPriceHistory.findOneAndUpdate(
            { ticker, date: today },
            {
              date: today,
              ticker,
              price: priceData.close,
              open: priceData.open,
              high: priceData.high,
              low: priceData.low,
              volume: priceData.volume
            },
            { upsert: true, new: true }
          );
        }
      }
      console.log('Daily ticker prices updated');
    } catch (err) {
      console.error('Portfolio update failed:', err);
    }
  });
}
