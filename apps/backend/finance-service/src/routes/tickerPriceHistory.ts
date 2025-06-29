import { Router } from 'express';
import { getTickerPriceHistory, fetchAndSaveTickerPrices } from '../controllers/tickerPriceHistory.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Get all portfolio history
router.get('/', authenticateToken, getTickerPriceHistory);
// Fetch and save latest prices
router.post('/fetch', authenticateToken, fetchAndSaveTickerPrices);

export default router;
