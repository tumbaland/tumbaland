export interface UserPortfolioResponse {
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: string;
  notes?: string;
}

export interface ErrorResponse {
  error: string;
}
