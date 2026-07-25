import TickerPriceHistory from '../models/TickerPriceHistory';
import TrackedTicker from '../models/TrackedTicker';
import { fetchStockPrice, fetchAndSaveAllStockHistory } from './alphaVantage.service';
import { BadRequestError } from '@tumbaland/backend-core';

interface TickerPriceResponse {
  _id?: string;
  date: string;
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

// Normalizes to the UTC midnight boundary for the given day, so the same
// value can be used in both the upsert filter and the written document —
// writing the untruncated "now" timestamp while filtering on the
// date-only string previously meant the filter could never match what a
// prior run had written, and every call inserted a duplicate row instead
// of updating one.
function toUtcDateOnly(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10));
}

/**
 * Get all ticker price history records
 */
export async function getTickerPriceHistory(): Promise<TickerPriceResponse[]> {
  const records = await TickerPriceHistory.find().sort({ date: -1 });

  const response: TickerPriceResponse[] = records
    .map((r) => ({
      _id: r._id?.toString(),
      date: r.date.toISOString(),
      ticker: r.ticker,
      price: r.price,
      open: r.open,
      high: r.high,
      low: r.low,
      volume: r.volume
    }))
    .sort((a, b) => {
      // Sort by ticker ASC, then by date DESC
      if (a.ticker < b.ticker) return -1;
      if (a.ticker > b.ticker) return 1;
      return b.date.localeCompare(a.date);
    });

  return response;
}

/**
 * Fetch and save ticker prices (all tracked tickers or specific ticker)
 */
export async function fetchAndSaveTickerPrices(tickerParam?: string): Promise<TickerPriceResponse[]> {
  const results: TickerPriceResponse[] = [];
  let tickers: string[];

  if (tickerParam) {
    tickers = [tickerParam];
  } else {
    // Fetch all tracked tickers from DB
    const trackedTickers = await TrackedTicker.find();
    tickers = trackedTickers.map((t) => t.ticker);
  }

  for (const ticker of tickers) {
    const priceData = await fetchStockPrice(ticker);
    if (priceData) {
      const today = toUtcDateOnly(new Date());
      const record = await TickerPriceHistory.findOneAndUpdate(
        { ticker, date: today },
        {
          ticker,
          date: today,
          price: priceData.close,
          open: priceData.open,
          high: priceData.high,
          low: priceData.low,
          volume: priceData.volume
        },
        { upsert: true, new: true }
      );

      results.push({
        date: record.date.toISOString(),
        ticker: record.ticker,
        price: record.price,
        open: record.open,
        high: record.high,
        low: record.low,
        volume: record.volume
      });
    }
  }

  return results;
}

/**
 * Fetch and save all historic prices for a ticker
 */
export async function fetchAllTickerHistory(ticker: string): Promise<number> {
  if (!ticker) {
    throw new BadRequestError('Ticker is required');
  }
  return fetchAndSaveAllStockHistory(ticker);
}

/**
 * Delete ticker price history record
 */
export async function deleteTickerPriceRecord(id: string): Promise<string> {
  if (!id) {
    throw new BadRequestError('ID is required');
  }
  await TickerPriceHistory.findByIdAndDelete(id);
  return id;
}

// Save latest price for a ticker to the database (legacy)
export async function fetchAndSaveLatestPrice(ticker: string): Promise<void> {
  const price = await fetchStockPrice(ticker);
  if (price === null) return;
  const today = toUtcDateOnly(new Date());
  await TickerPriceHistory.findOneAndUpdate(
    { ticker, date: today },
    { ticker, date: today, price },
    { upsert: true, new: true }
  );
}
