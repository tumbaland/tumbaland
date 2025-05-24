import { useState, useEffect } from 'react';
import { Asset, PortfolioSummary } from '../types/Asset';
import { assetService } from '../services/assetService';

export const useAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await assetService.fetchAssets();
      setAssets(data.data.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculatePortfolioSummary = (): PortfolioSummary => {
    const totals = assets.reduce(
      (acc, asset) => {
        const buyValue = asset.quantity * asset.buyPrice;
        const currentValue = asset.quantity * asset.currentPrice;
        return {
          totalBuyValue: acc.totalBuyValue + buyValue,
          totalCurrentValue: acc.totalCurrentValue + currentValue,
        };
      },
      { totalBuyValue: 0, totalCurrentValue: 0 }
    );

    const totalProfitLoss = totals.totalCurrentValue - totals.totalBuyValue;
    const totalProfitLossPercentage = totals.totalBuyValue > 0 
      ? ((totalProfitLoss / totals.totalBuyValue) * 100) 
      : 0;

    return {
      ...totals,
      totalProfitLoss,
      totalProfitLossPercentage,
      totalAssets: assets.length,
    };
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return {
    assets,
    loading,
    error,
    fetchAssets,
    portfolioSummary: calculatePortfolioSummary(),
  };
};
