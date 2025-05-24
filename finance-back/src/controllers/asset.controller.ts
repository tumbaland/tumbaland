import { Request, Response } from 'express';
import * as AssetService from '../services/asset.service';
import { IAsset } from '../models/Asset';

// Create a new asset
export const createAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const assetData: Partial<IAsset> = req.body;
    
    // Validate required fields
    if (!assetData.name || !assetData.quantity || !assetData.buyPrice || !assetData.currentPrice || !assetData.date) {
      res.status(400).json({
        error: 'Missing required fields: name, quantity, buyPrice, currentPrice, and date are required'
      });
      return;
    }

    // Validate numeric fields
    if (assetData.quantity < 0 || assetData.buyPrice < 0 || assetData.currentPrice < 0) {
      res.status(400).json({
        error: 'Quantity, buyPrice, and currentPrice must be positive numbers'
      });
      return;
    }

    const asset = await AssetService.createAsset(assetData);
    res.status(201).json({
      success: true,
      data: asset
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message
    });
  }
};

// Get all assets with filters
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      startDate,
      endDate,
      limit,
      page
    } = req.query;

    const filters: any = {};
    
    if (name) filters.name = name as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (limit) filters.limit = parseInt(limit as string);
    if (page) filters.page = parseInt(page as string);

    const result = await AssetService.getAssets(filters);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get asset by ID
export const getAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const asset = await AssetService.getAssetById(id);
    
    if (!asset) {
      res.status(404).json({
        error: 'Asset not found'
      });
      return;
    }

    res.json({
      success: true,
      data: asset
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Update asset by ID
export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate numeric fields if provided
    if (updateData.quantity !== undefined && updateData.quantity < 0) {
      res.status(400).json({
        error: 'Quantity must be a positive number'
      });
      return;
    }

    if (updateData.buyPrice !== undefined && updateData.buyPrice < 0) {
      res.status(400).json({
        error: 'Buy price must be a positive number'
      });
      return;
    }

    if (updateData.currentPrice !== undefined && updateData.currentPrice < 0) {
      res.status(400).json({
        error: 'Current price must be a positive number'
      });
      return;
    }

    const asset = await AssetService.updateAsset(id, updateData);
    
    if (!asset) {
      res.status(404).json({
        error: 'Asset not found'
      });
      return;
    }

    res.json({
      success: true,
      data: asset
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message
    });
  }
};

// Delete asset by ID
export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await AssetService.deleteAsset(id);
    
    if (!deleted) {
      res.status(404).json({
        error: 'Asset not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get portfolio summary
export const getPortfolioSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await AssetService.getPortfolioSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get assets by date range
export const getAssetsByDateRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'Both startDate and endDate are required'
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (start > end) {
      res.status(400).json({
        error: 'startDate must be before endDate'
      });
      return;
    }

    const assets = await AssetService.getAssetsByDateRange(start, end);
    
    res.json({
      success: true,
      data: assets
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get recent assets
export const getRecentAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 10;

    if (limitNum < 1 || limitNum > 50) {
      res.status(400).json({
        error: 'Limit must be between 1 and 50'
      });
      return;
    }

    const assets = await AssetService.getRecentAssets(limitNum);
    
    res.json({
      success: true,
      data: assets
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get top performing assets
export const getTopPerformers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 5;

    if (limitNum < 1 || limitNum > 20) {
      res.status(400).json({
        error: 'Limit must be between 1 and 20'
      });
      return;
    }

    const topPerformers = await AssetService.getTopPerformers(limitNum);
    
    res.json({
      success: true,
      data: topPerformers
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Update current prices (bulk update)
export const updateCurrentPrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { priceUpdates } = req.body;

    if (!priceUpdates || !Array.isArray(priceUpdates)) {
      res.status(400).json({
        error: 'priceUpdates array is required'
      });
      return;
    }

    // Validate each price update
    for (const update of priceUpdates) {
      if (!update.id || typeof update.currentPrice !== 'number' || update.currentPrice < 0) {
        res.status(400).json({
          error: 'Each price update must have id and a positive currentPrice'
        });
        return;
      }
    }

    const updatedCount = await AssetService.updateCurrentPrices(priceUpdates);
    
    res.json({
      success: true,
      data: {
        updatedCount,
        totalUpdates: priceUpdates.length
      }
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message
    });
  }
};
