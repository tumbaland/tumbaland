import { Request, Response } from 'express';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { fetchStockPrice } from '../services/yahooFinance.service';
import TrackedTicker from '../models/TrackedTicker';
import { TickerPriceHistoryResponse, FetchAndSavePricesResponse } from '../types/tickerPriceHistory.types';

// GET /api/ticker-price-history - get all ticker price history records
export const getTickerPriceHistory = async (req: Request, res: Response<TickerPriceHistoryResponse[]>) => {
  try {
    const records = await TickerPriceHistory.find().sort({ date: -1 });
    const response: TickerPriceHistoryResponse[] = records.map(r => ({
      date: r.date.toISOString(),
      ticker: r.ticker,
      price: r.price
    }));
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticker price history' } as any);
  }
};

// POST /api/ticker-price-history - fetch and save latest prices for all tracked tickers
export const fetchAndSaveTickerPrices = async (req: Request, res: Response<FetchAndSavePricesResponse>) => {
  const results: TickerPriceHistoryResponse[] = [];
  // Fetch tracked tickers from DB
  const trackedTickers = await TrackedTicker.find();
  for (const tracked of trackedTickers) {
    const ticker = tracked.ticker;
    const price = await fetchStockPrice(ticker);
    if (price) {
      const record = await TickerPriceHistory.create({
        date: new Date(),
        ticker,
        price
      });
      results.push({
        date: record.date.toISOString(),
        ticker: record.ticker,
        price: record.price
      });
    }
  }
  res.status(200).json({ message: 'Prices fetched and saved', results });
};
