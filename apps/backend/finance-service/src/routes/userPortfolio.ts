import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/core';
import {
  getUserPortfolios,
  addUserPortfolio,
  removeUserPortfolio,
  editUserPortfolio
} from '../controllers/userPortfolio.controller';
import { createUserPortfolioSchema, updateUserPortfolioSchema } from '../validation/schemas';

const router = Router();

router.get('/', authenticateToken, getUserPortfolios);
router.post('/', authenticateToken, validate(createUserPortfolioSchema), addUserPortfolio);
router.put('/:id', authenticateToken, validate(updateUserPortfolioSchema), editUserPortfolio);
router.delete('/:id', authenticateToken, removeUserPortfolio);

export default router;
