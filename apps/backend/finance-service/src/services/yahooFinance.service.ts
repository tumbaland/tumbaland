import axios from 'axios';

// Example: Fetch stock price from Yahoo Finance (can be replaced with another API)
export async function fetchStockPrice(symbol: string): Promise<number | null> {
  try {
    // Yahoo Finance API via rapidapi.com (replace with your API key and endpoint)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const response = await axios.get(url);
    const price = response.data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return null;
  }
}
