import { Router } from 'express';
import express from 'express';
import { authenticateAgent, requireScope } from '@tumbaland/backend-core';
import {
  getTransactions,
  getCategories,
  getSummary,
  getAnalyticsReport,
  getRecurring,
  importTransactions,
  exportTransactionsCsv,
  editCategory,
  bulkRecategorise,
  removeTransaction
} from '../controllers/transaction.controller';

const router = Router();

router.use(authenticateAgent());

/**
 * Statements arrive as raw CSV, well past the default 100kb JSON limit — a
 * decade of one account is a couple of hundred kilobytes. `express.json()`
 * only claims `application/json`, so a text parser scoped to this route
 * composes with it rather than fighting it.
 */
// Raw rather than text: the Pensionikeskus export is ISO-8859-1, and letting
// the body parser assume UTF-8 corrupts the Estonian row names the import
// matches on. The controller sniffs the encoding instead.
const csvBody = express.raw({
  type: ['text/csv', 'text/plain', 'application/octet-stream'],
  limit: '15mb'
});

// These must precede /:id so they are not read as transaction ids
router.get('/categories', requireScope('finance:read'), getCategories);
router.get('/summary', requireScope('finance:read'), getSummary);
router.get('/analytics', requireScope('finance:read'), getAnalyticsReport);
router.get('/recurring', requireScope('finance:read'), getRecurring);
router.post('/import', requireScope('finance:write'), csvBody, importTransactions);
// Export honours the same filters as the list: pulling out the uncategorised
// rows, sorting them in a spreadsheet and handing the file back is the point.
router.get('/export', requireScope('finance:read'), exportTransactionsCsv);
router.get('/', requireScope('finance:read'), getTransactions);
// Entries come from imports rather than by hand, so there is no create route
// and no general update. The category is the exception: it is ours rather than
// the bank's, and the uncategorised backlog has to be fillable.
router.post('/recategorise', requireScope('finance:write'), bulkRecategorise);
router.patch('/:id/category', requireScope('finance:write'), editCategory);
router.delete('/:id', requireScope('finance:write'), removeTransaction);

export default router;
