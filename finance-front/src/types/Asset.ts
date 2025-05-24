// Asset-related type definitions
export interface Asset {
  _id: string;
  name: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  date: string;
  totalBuyValue?: number;
  totalCurrentValue?: number;
  profitLoss?: number;
  profitLossPercentage?: number;
}

export interface AssetResponse {
  success: boolean;
  data: {
    assets: Asset[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface PortfolioSummary {
  totalBuyValue: number;
  totalCurrentValue: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  totalAssets: number;
}
