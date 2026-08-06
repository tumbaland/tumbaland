import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import { getBudgets, addBudget, editBudget, removeBudget } from '../controllers/transaction.controller';
import { createBudgetSchema, updateBudgetSchema } from '../validation/schemas';

const router = Router();

router.use(authenticateToken);

router.get('/', getBudgets);
router.post('/', validate(createBudgetSchema), addBudget);
router.put('/:id', validate(updateBudgetSchema), editBudget);
router.delete('/:id', removeBudget);

export default router;
