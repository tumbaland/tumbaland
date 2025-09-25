import TickerPriceHistory from '../models/TickerPriceHistory';

// Fetch all historic OHLCV prices for a symbol and save to DB
export async function fetchAndSaveAllStockHistory(symbol: string): Promise<number> {
  const BASE_URL = 'https://www.alphavantage.co/query';
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error('Alpha Vantage API key not set in environment variables');
  }
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return 0;
    let saved = 0;
    for (const [date, data] of Object.entries(timeSeries)) {
      const d = data as Record<string, string>;
      await TickerPriceHistory.findOneAndUpdate(
        { ticker: symbol, date: new Date(date) },
        {
          ticker: symbol,
          date: new Date(date),
          price: parseFloat(d['4. close']),
          open: parseFloat(d['1. open']),
          high: parseFloat(d['2. high']),
          low: parseFloat(d['3. low']),
          volume: parseFloat(d['5. volume'])
        },
        { upsert: true, new: true }
      );
      saved++;
    }
    return saved;
  } catch (error) {
    console.error('Error fetching/saving stock history from Alpha Vantage:', error);
    return 0;
  }
}
export interface StockPriceData {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

// Fetch latest OHLCV price for a symbol (supports European stocks)
export async function fetchStockPrice(symbol: string): Promise<StockPriceData | null> {
  const BASE_URL = 'https://www.alphavantage.co/query';
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error('Alpha Vantage API key not set in environment variables');
  }
  try {
    const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return null;
    const latestDate = Object.keys(timeSeries)[0];
    const latest = timeSeries[latestDate];
    if (!latest) return null;
    return {
      close: parseFloat(latest['4. close']),
      open: parseFloat(latest['1. open']),
      high: parseFloat(latest['2. high']),
      low: parseFloat(latest['3. low']),
      volume: parseFloat(latest['5. volume'])
    };
  } catch (error) {
    console.error('Error fetching stock price from Alpha Vantage:', error);
    return null;
  }
}
