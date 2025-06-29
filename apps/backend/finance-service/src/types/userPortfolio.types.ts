export interface UserPortfolioResponse {
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
  latestPrice?: number;
  currentValue?: number;
  valueIncrease?: number;
  percentIncrease?: number;
}

export interface ErrorResponse {
  error: string;
}
