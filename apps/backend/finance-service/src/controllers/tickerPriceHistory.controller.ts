import { Request, Response } from 'express';
import * as tickerPriceService from '../services/tickerPriceHistory.service';

/**
 * Get all ticker price history records
 */
export const getTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const records = await tickerPriceService.getTickerPriceHistory();

    res.json({
      success: true,
      data: records
    });
  } catch (error: any) {
    console.error('Error fetching ticker price history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch ticker price history'
    });
  }
};

/**
 * Fetch and save latest ticker prices
 */
export const fetchAndSaveTickerPrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticker } = req.body;

    const results = await tickerPriceService.fetchAndSaveTickerPrices(ticker);

    res.json({
      success: true,
      message: 'Prices fetched and saved',
      data: results
    });
  } catch (error: any) {
    console.error('Error fetching ticker prices:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch and save ticker prices'
    });
  }
};

/**
 * Fetch and save all historic prices for a ticker
 */
export const fetchAndSaveAllTickerHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticker } = req.body;

    if (!ticker) {
      res.status(400).json({
        success: false,
        message: 'Missing ticker in request body'
      });
      return;
    }

    const savedCount = await tickerPriceService.fetchAllTickerHistory(ticker);

    res.json({
      success: true,
      message: `Fetched and saved ${savedCount} records for ${ticker}`,
      data: { ticker, recordsCount: savedCount }
    });
  } catch (error: any) {
    console.error('Error fetching all ticker history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch and save all ticker history'
    });
  }
};

/**
 * Delete ticker price history record
 */
export const deleteTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Missing ID in request'
      });
      return;
    }

    await tickerPriceService.deleteTickerPriceRecord(id as string);

    res.json({
      success: true,
      message: 'Price history record deleted successfully',
      data: { id }
    });
  } catch (error: any) {
    console.error('Error deleting ticker price history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete ticker price history'
    });
  }
};
