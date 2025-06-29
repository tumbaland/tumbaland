import { Router } from 'express';
import { getTickerPriceHistory, fetchAndSaveTickerPrices, deleteTickerPriceHistory } from '../controllers/tickerPriceHistory.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Get all portfolio history
router.get('/', authenticateToken, getTickerPriceHistory);
// Fetch and save latest prices
router.post('/fetch', authenticateToken, fetchAndSaveTickerPrices);
// Delete a price history record by id
router.delete('/:id', authenticateToken, deleteTickerPriceHistory);

export default router;
