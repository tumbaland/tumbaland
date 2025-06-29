export interface TickerPriceHistoryResponse {
  date: string;
  ticker: string;
  price: number;
}

export interface FetchAndSavePricesResponse {
  message: string;
  results: TickerPriceHistoryResponse[];
}
