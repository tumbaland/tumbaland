import { Router } from 'express';
import {
  getUserPortfolios,
  addUserPortfolio,
  removeUserPortfolio,
  editUserPortfolio
} from '../controllers/userPortfolio.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { validateBody } from '../validation/validateBody';
import { userPortfolioSchema } from '../validation/schemas';

const router = Router();

router.get('/', authenticateToken, getUserPortfolios);
router.post('/', authenticateToken, validateBody(userPortfolioSchema) as any, addUserPortfolio as any);
router.put('/:id', authenticateToken, validateBody(userPortfolioSchema) as any, editUserPortfolio as any);
router.delete('/:id', authenticateToken, removeUserPortfolio);

export default router;
