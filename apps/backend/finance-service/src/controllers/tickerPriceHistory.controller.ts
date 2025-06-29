import { Request, Response } from 'express';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { fetchStockPrice } from '../services/alphaVantage.service';
import TrackedTicker from '../models/TrackedTicker';
import { TickerPriceHistoryResponse, FetchAndSavePricesResponse } from '../types/tickerPriceHistory.types';

// GET /api/ticker-price-history - get all ticker price history records
export const getTickerPriceHistory = async (req: Request, res: Response<TickerPriceHistoryResponse[]>) => {
  try {
    const records = await TickerPriceHistory.find().sort({ date: -1 });
    const response: TickerPriceHistoryResponse[] = records
      .map(r => ({
        _id: r._id?.toString(), // Add the MongoDB id to the response
        date: r.date.toISOString(),
        ticker: r.ticker,
        price: r.price,
        open: r.open,
        high: r.high,
        low: r.low,
        volume: r.volume,
        close: r.price // Add close price for frontend compatibility
      }))
      .sort((a, b) => {
        // Sort by ticker ASC, then by date DESC
        if (a.ticker < b.ticker) return -1;
        if (a.ticker > b.ticker) return 1;
        return b.date.localeCompare(a.date);
      });
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticker price history' } as any);
  }
};

// POST /api/ticker-price-history - fetch and save latest prices for all tracked tickers or a specific ticker
export const fetchAndSaveTickerPrices = async (req: Request, res: Response<FetchAndSavePricesResponse>) => {
  const results: TickerPriceHistoryResponse[] = [];
  let tickers: string[] = [];
  if (req.body && req.body.ticker) {
    tickers = [req.body.ticker];
  } else {
    // Fetch all tracked tickers from DB
    const trackedTickers = await TrackedTicker.find();
    tickers = trackedTickers.map(t => t.ticker);
  }
  for (const ticker of tickers) {
    const priceData = await fetchStockPrice(ticker);
    if (priceData) {
      const today = new Date();
      const record = await TickerPriceHistory.findOneAndUpdate(
        { ticker, date: today.toISOString().slice(0, 10) },
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
  res.status(200).json({ message: 'Prices fetched and saved', results });
};

// DELETE /api/ticker-price-history/:id - delete a price history record by id
export const deleteTickerPriceHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await TickerPriceHistory.findByIdAndDelete(id);
    res.status(200).json({ id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete price history record', id });
  }
};
