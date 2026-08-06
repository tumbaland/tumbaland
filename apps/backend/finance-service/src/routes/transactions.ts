import { Router } from 'express';
import express from 'express';
import { authenticateToken } from '@tumbaland/backend-core';
import {
  getTransactions,
  getCategories,
  getSummary,
  getAnalyticsReport,
  importTransactions,
  removeTransaction
} from '../controllers/transaction.controller';

const router = Router();

router.use(authenticateToken);

/**
 * Statements arrive as raw CSV, well past the default 100kb JSON limit — a
 * decade of one account is a couple of hundred kilobytes. `express.json()`
 * only claims `application/json`, so a text parser scoped to this route
 * composes with it rather than fighting it.
 */
const csvBody = express.text({ type: ['text/csv', 'text/plain'], limit: '15mb' });

// These must precede /:id so they are not read as transaction ids
router.get('/categories', getCategories);
router.get('/summary', getSummary);
router.get('/analytics', getAnalyticsReport);
router.post('/import', csvBody, importTransactions);
router.get('/', getTransactions);
// Entries come from imports rather than by hand, so there is no create or
// update route; delete stays, for backing out a bad import.
router.delete('/:id', removeTransaction);

export default router;
