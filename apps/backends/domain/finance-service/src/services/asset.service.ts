import { Asset, IAsset } from '../models/Asset';

// Create a new asset
export const createAsset = async (assetData: Partial<IAsset>): Promise<IAsset> => {
  try {
    const asset = new Asset(assetData);
    return await asset.save();
  } catch (error: any) {
    throw new Error(`Failed to create asset: ${error.message}`);
  }
};

// Get all assets with optional filters
export const getAssets = async (filters: {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  page?: number;
} = {}): Promise<{ assets: IAsset[]; total: number; page: number; totalPages: number }> => {
  try {
    const {
      name,
      startDate,
      endDate,
      limit = 20,
      page = 1
    } = filters;

    // Build query
    const query: any = {};
    
    if (name) {
      query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute queries
    const [assets, total] = await Promise.all([
      Asset.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Asset.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      assets: assets as IAsset[],
      total,
      page,
      totalPages
    };
  } catch (error: any) {
    throw new Error(`Failed to get assets: ${error.message}`);
  }
};

// Get asset by ID
export const getAssetById = async (id: string): Promise<IAsset | null> => {
  try {
    return await Asset.findById(id);
  } catch (error: any) {
    throw new Error(`Failed to get asset: ${error.message}`);
  }
};

// Update asset by ID
export const updateAsset = async (id: string, updateData: Partial<IAsset>): Promise<IAsset | null> => {
  try {
    return await Asset.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  } catch (error: any) {
    throw new Error(`Failed to update asset: ${error.message}`);
  }
};

// Delete asset by ID
export const deleteAsset = async (id: string): Promise<boolean> => {
  try {
    const result = await Asset.findByIdAndDelete(id);
    return !!result;
  } catch (error: any) {
    throw new Error(`Failed to delete asset: ${error.message}`);
  }
};

// Get portfolio summary
export const getPortfolioSummary = async (): Promise<any> => {
  try {
    const summary = await Asset.getPortfolioSummary();
    return summary[0] || {
      totalAssets: 0,
      totalBuyValue: 0,
      totalCurrentValue: 0,
      totalProfitLoss: 0,
      profitLossPercentage: 0
    };
  } catch (error: any) {
    throw new Error(`Failed to get portfolio summary: ${error.message}`);
  }
};

// Get assets by date range
export const getAssetsByDateRange = async (startDate: Date, endDate: Date): Promise<IAsset[]> => {
  try {
    return await Asset.getAssetsByDateRange(startDate, endDate);
  } catch (error: any) {
    throw new Error(`Failed to get assets by date range: ${error.message}`);
  }
};

// Get recent assets
export const getRecentAssets = async (limit: number = 10): Promise<IAsset[]> => {
  try {
    return await Asset.find()
      .sort({ createdAt: -1 })
      .limit(limit);
  } catch (error: any) {
    throw new Error(`Failed to get recent assets: ${error.message}`);
  }
};

// Get top performing assets
export const getTopPerformers = async (limit: number = 5): Promise<any[]> => {
  try {
    return await Asset.getTopPerformers(limit);
  } catch (error: any) {
    throw new Error(`Failed to get top performers: ${error.message}`);
  }
};

// Update current prices for all assets (bulk update)
export const updateCurrentPrices = async (priceUpdates: { id: string; currentPrice: number }[]): Promise<number> => {
  try {
    let updatedCount = 0;
    
    for (const update of priceUpdates) {
      const result = await Asset.findByIdAndUpdate(
        update.id,
        { currentPrice: update.currentPrice },
        { new: true, runValidators: true }
      );
      if (result) updatedCount++;
    }
    
    return updatedCount;
  } catch (error: any) {
    throw new Error(`Failed to update current prices: ${error.message}`);
  }
};
