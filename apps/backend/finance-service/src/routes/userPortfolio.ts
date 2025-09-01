import { Router } from 'express';
import {
  getUserPortfolios,
  addUserPortfolio,
  removeUserPortfolio,
  editUserPortfolio
} from '../controllers/userPortfolio.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { userGroupsMiddleware } from '../middleware/userGroupsMiddleware';
import { validateBody } from '../validation/validateBody';
import { userPortfolioSchema } from '../validation/schemas';

const router = Router();

router.get('/', authenticateToken, userGroupsMiddleware, getUserPortfolios);
router.post('/', authenticateToken, userGroupsMiddleware, validateBody(userPortfolioSchema) as any, addUserPortfolio as any);
router.put('/:id', authenticateToken, userGroupsMiddleware, validateBody(userPortfolioSchema) as any, editUserPortfolio as any);
router.delete('/:id', authenticateToken, userGroupsMiddleware, removeUserPortfolio);

export default router;
