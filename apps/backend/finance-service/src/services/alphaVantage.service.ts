import TickerPriceHistory from '../models/TickerPriceHistory';

const BASE_URL = 'https://www.alphavantage.co/query';

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error('Alpha Vantage API key not set in environment variables');
  return key;
}

// Alpha Vantage returns HTTP 200 with a Note/Information field when throttled
function isThrottled(data: Record<string, unknown>): boolean {
  return !!(data['Note'] || data['Information']);
}

function getThrottleMessage(data: Record<string, unknown>): string {
  return String(data['Note'] || data['Information'] || 'Rate limit hit');
}

export interface StockPriceData {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  date: string; // YYYY-MM-DD (actual trading day from API)
}

export interface TickerSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: string;
}

// Fetch the latest quote for a symbol using GLOBAL_QUOTE (1 call, returns OHLCV + trading date).
// More efficient than TIME_SERIES_DAILY which downloads 100 days just to read the first row.
export async function fetchStockPrice(symbol: string): Promise<StockPriceData | null> {
  const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${getApiKey()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (isThrottled(data)) {
    console.warn(`Alpha Vantage rate limit hit for ${symbol}: ${getThrottleMessage(data)}`);
    return null;
  }

  const quote = data['Global Quote'] as Record<string, string> | undefined;
  if (!quote || !quote['05. price']) return null;

  return {
    close: parseFloat(quote['05. price']),
    open: parseFloat(quote['02. open']),
    high: parseFloat(quote['03. high']),
    low: parseFloat(quote['04. low']),
    volume: parseFloat(quote['06. volume']),
    date: quote['07. latest trading day']
  };
}

// Fetch historic OHLCV prices for a symbol and save to DB.
// Returns last ~100 trading days (compact). outputsize=full requires a premium plan.
export async function fetchAndSaveAllStockHistory(symbol: string): Promise<number> {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${getApiKey()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (isThrottled(data)) {
    throw new Error(`Alpha Vantage rate limit: ${getThrottleMessage(data)}`);
  }

  const timeSeries = data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) return 0;

  let saved = 0;
  for (const [date, entry] of Object.entries(timeSeries)) {
    await TickerPriceHistory.findOneAndUpdate(
      { ticker: symbol, date: new Date(date) },
      {
        ticker: symbol,
        date: new Date(date),
        price: parseFloat(entry['4. close']),
        open: parseFloat(entry['1. open']),
        high: parseFloat(entry['2. high']),
        low: parseFloat(entry['3. low']),
        volume: parseFloat(entry['5. volume'])
      },
      { upsert: true, new: true }
    );
    saved++;
  }
  return saved;
}

// Search for ticker symbols by keyword using Alpha Vantage SYMBOL_SEARCH.
// Costs 1 API call. Free plan: 25 calls/day total.
export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  const url = `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${getApiKey()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (isThrottled(data)) {
    throw new Error(`Alpha Vantage rate limit: ${getThrottleMessage(data)}`);
  }

  const matches = (data['bestMatches'] || []) as Record<string, string>[];
  return matches.map((m) => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: m['3. type'],
    region: m['4. region'],
    currency: m['8. currency'],
    matchScore: m['9. matchScore']
  }));
}
