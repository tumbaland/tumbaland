import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  getTickerPriceHistory,
  fetchAndSaveTickerPrices,
  deleteTickerPriceHistory,
  fetchAndSaveAllTickerHistory
} from '../controllers/tickerPriceHistory.controller';
import { tickerFetchSchema } from '../validation/schemas';

const router = Router();
// Fetch and save all historic prices for a ticker
router.post('/fetch-all', authenticateToken, validate(tickerFetchSchema), fetchAndSaveAllTickerHistory);

// Get all portfolio history
router.get('/', authenticateToken, getTickerPriceHistory);
// Fetch and save latest prices
router.post('/fetch', authenticateToken, validate(tickerFetchSchema), fetchAndSaveTickerPrices);
// Delete a price history record by id
router.delete('/:id', authenticateToken, deleteTickerPriceHistory);

export default router;
