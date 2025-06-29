export interface TickerPriceHistoryResponse {
  date: string;
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface FetchAndSavePricesResponse {
  message: string;
  results: TickerPriceHistoryResponse[];
}
