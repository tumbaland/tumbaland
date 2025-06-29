import axios from 'axios';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export interface StockPriceData {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

// Fetch latest OHLCV price for a symbol (supports European stocks)
export async function fetchStockPrice(symbol: string): Promise<StockPriceData | null> {
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error('Alpha Vantage API key not set in environment variables');
  }
  try {
    const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const response = await axios.get(url);
    const timeSeries = response.data['Time Series (Daily)'];
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
