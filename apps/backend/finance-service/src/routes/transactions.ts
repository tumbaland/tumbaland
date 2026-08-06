import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  getTransactions,
  getCategories,
  getSummary,
  addTransaction,
  editTransaction,
  removeTransaction
} from '../controllers/transaction.controller';
import { createTransactionSchema, updateTransactionSchema } from '../validation/schemas';

const router = Router();

router.use(authenticateToken);

// Both must precede /:id so they are not read as transaction ids
router.get('/categories', getCategories);
router.get('/summary', getSummary);
router.get('/', getTransactions);
router.post('/', validate(createTransactionSchema), addTransaction);
router.put('/:id', validate(updateTransactionSchema), editTransaction);
router.delete('/:id', removeTransaction);

export default router;
