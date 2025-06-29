import TickerPriceHistory from '../models/TickerPriceHistory';
import { fetchStockPrice } from './alphaVantage.service';

// Save latest price for a ticker to the database
export async function fetchAndSaveLatestPrice(ticker: string): Promise<void> {
  const price = await fetchStockPrice(ticker);
  if (price === null) return;
  const today = new Date();
  await TickerPriceHistory.findOneAndUpdate(
    { ticker, date: today.toISOString().slice(0, 10) },
    { ticker, date: today, price },
    { upsert: true, new: true }
  );
}
