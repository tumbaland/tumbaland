import { Request, Response } from 'express';
import { BadRequestError, sendSuccess, countRead } from '@tumbaland/backend-core';
import * as transactionService from '../services/transaction.service';
import { getCashflowSummary, DEFAULT_MONTHS } from '../services/cashflow.service';
import { getAnalytics } from '../services/analytics.service';
import {
  getRecurringPayments,
  DEFAULT_MONTHS as RECURRING_MONTHS
} from '../services/recurring.service';
import { decodeStatement } from '../services/pensionStatement.service';
import {
  importStatement,
  importPensionStatement,
  importCategories,
  detectFormat,
  FORMAT_LABELS,
  TransactionFileFormat
} from '../services/transactionImport.service';
import { exportTransactions } from '../services/transactionExport.service';
import { TransactionType } from '../models/Transaction';
import { contextGroupId, contextGroups } from '../utils/scope';

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(typeof value === 'string' ? value : NaN);
  if (isNaN(date.getTime())) {
    throw new BadRequestError(`${field} must be a valid date`);
  }
  return date;
}

function parsePositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestError(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseOffset(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestError(`${field} must be zero or a positive integer`);
  }
  return parsed;
}

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { from, to, type, category, search, sort, direction, limit, skip } = req.query;

  if (type && type !== 'income' && type !== 'expense') {
    throw new BadRequestError('type must be income or expense');
  }
  if (sort && sort !== 'date' && sort !== 'amount') {
    throw new BadRequestError('sort must be date or amount');
  }
  if (direction && direction !== 'asc' && direction !== 'desc') {
    throw new BadRequestError('direction must be asc or desc');
  }

  const page = await transactionService.getTransactions(user.id, contextGroups(req), {
    from: parseDate(from, 'from'),
    to: parseDate(to, 'to'),
    type: type as TransactionType | undefined,
    category: typeof category === 'string' && category ? category : undefined,
    search: typeof search === 'string' && search ? search : undefined,
    sort: sort === 'amount' ? 'amount' : sort === 'date' ? 'date' : undefined,
    direction: direction === 'asc' ? 'asc' : direction === 'desc' ? 'desc' : undefined,
    limit: parsePositiveInt(limit, 'limit'),
    skip: parseOffset(skip, 'skip')
  });

  // The page, not the filter's total: the count records what actually left
  // the server, and `totals.count` covers everything the filter matched.
  countRead(res, page.items.length);
  sendSuccess(res, page);
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const categories = await transactionService.getCategories(user.id, contextGroups(req));

  sendSuccess(res, categories);
};

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const summary = await getCashflowSummary(user.id, {
    months: parsePositiveInt(req.query.months, 'months') ?? DEFAULT_MONTHS,
    groupId: contextGroupId(req)
  });

  sendSuccess(res, summary);
};

export const getRecurring = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const recurring = await getRecurringPayments(user.id, {
    months: parsePositiveInt(req.query.months, 'months') ?? RECURRING_MONTHS,
    groupId: contextGroupId(req)
  });

  sendSuccess(res, recurring);
};

export const removeTransaction = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await transactionService.deleteTransaction(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Transaction deleted');
};

/** Long-run trends: income and spending year on year, and what moved them. */
export const getAnalyticsReport = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const analytics = await getAnalytics(user.id, contextGroupId(req));

  sendSuccess(res, analytics);
};

/**
 * Import a CSV. The body is raw text, which is why this route mounts its own
 * text parser rather than relying on the JSON one.
 *
 * Two shapes arrive here: a bank statement, and one of this app's own exports
 * with the categories edited. They come through the same upload because that is
 * what "import this file" means to whoever is holding it — the format decides
 * what happens, not a separate button.
 */
export const importTransactions = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const groupId = contextGroupId(req);
  // Raw bytes, decoded here rather than by the body parser: the Pensionikeskus
  // export is ISO-8859-1 and every other file is UTF-8. Decoded as the wrong
  // one, "Osakute märkimine" becomes mojibake — and since that string is what
  // selects the rows, the import finds nothing and reports success.
  const csv = decodeStatement(Buffer.isBuffer(req.body) ? req.body : String(req.body ?? ''));

  const options = {
    userId: user.id,
    groupId,
    userGroups: req.userGroups || []
  };

  const declared = req.query.format as TransactionFileFormat | undefined;
  if (declared && !(declared in FORMAT_LABELS)) {
    throw new BadRequestError(`format must be one of ${Object.keys(FORMAT_LABELS).join(', ')}`);
  }

  const detected = detectFormat(csv);
  if (detected === null) {
    throw new BadRequestError(
      'Unrecognised file. Expected a SEB account statement (a "Kliendi konto" column), ' +
      'a Pensionikeskus statement (a "Sammas" column), or a Tumbaland export ' +
      '(an "id" and a "category" column).'
    );
  }
  // A declared format that disagrees with the file is a mistake worth stopping
  // on: reading a statement as a category list would silently do nothing.
  if (declared && declared !== detected) {
    throw new BadRequestError(
      `This looks like a ${FORMAT_LABELS[detected]}, not a ${FORMAT_LABELS[declared]}.`
    );
  }

  if (detected === 'tumbaland') {
    const result = await importCategories(csv, options);
    sendSuccess(
      res,
      result,
      result.updated > 0
        ? `Recategorised ${result.updated} transaction${result.updated === 1 ? '' : 's'}`
        : 'No categories changed'
    );
    return;
  }

  if (detected === 'pensionikeskus') {
    const result = await importPensionStatement(csv, options);
    const covered = result.coveredByBank > 0
      ? `; ${result.coveredByBank} already paid by bank transfer`
      : '';
    sendSuccess(
      res,
      result,
      result.imported > 0
        ? `Imported ${result.imported} contribution${result.imported === 1 ? '' : 's'}${covered}`
        : `Nothing new to import${covered || '; all contributions already held'}`
    );
    return;
  }

  const result = await importStatement(csv, options);

  const recorded = result.trades.imported > 0
    ? `; ${result.trades.imported} trade${result.trades.imported === 1 ? '' : 's'} added to the trade log`
    : '';
  sendSuccess(
    res,
    result,
    (result.duplicates > 0
      ? `Imported ${result.imported}; ${result.duplicates} already present`
      : `Imported ${result.imported} transactions`) + recorded
  );
};

/**
 * Export the rows a filter matches as CSV, for categorising in a spreadsheet
 * and handing back through the import above.
 */
export const exportTransactionsCsv = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { from, to, type, category, search, format } = req.query;

  if (type && type !== 'income' && type !== 'expense') {
    throw new BadRequestError('type must be income or expense');
  }
  // Only this app's own shape is produced. Emitting something that claimed to
  // be a bank statement would be fabricating a bank record, and the columns a
  // statement carries are not all ours to invent.
  if (format && format !== 'tumbaland') {
    throw new BadRequestError('Only the tumbaland export format is produced');
  }

  const { csv, filename } = await exportTransactions(user.id, contextGroups(req), {
    from: parseDate(from, 'from'),
    to: parseDate(to, 'to'),
    type: type as TransactionType | undefined,
    category: typeof category === 'string' && category ? category : undefined,
    search: typeof search === 'string' && search ? search : undefined
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};

/** Recategorise one transaction — the only field an import lets you edit. */
export const editCategory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;
  const { category } = req.body || {};

  if (!category || typeof category !== 'string' || !category.trim()) {
    throw new BadRequestError('category is required');
  }

  const updated = await transactionService.updateCategory(
    id as string,
    category.trim(),
    user.id,
    userGroups
  );

  sendSuccess(res, updated, 'Category updated');
};

/** Recategorise every row matching a category, optionally narrowed by text. */
export const bulkRecategorise = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { fromCategory, toCategory, search } = req.body || {};

  if (!fromCategory || typeof fromCategory !== 'string') {
    throw new BadRequestError('fromCategory is required');
  }
  if (!toCategory || typeof toCategory !== 'string' || !toCategory.trim()) {
    throw new BadRequestError('toCategory is required');
  }

  const groups = contextGroups(req);
  const updated = await transactionService.recategorise(
    { fromCategory, search: typeof search === 'string' && search ? search : undefined },
    toCategory.trim(),
    user.id,
    groups
  );

  sendSuccess(res, { updated }, `Moved ${updated} transaction${updated === 1 ? '' : 's'} to ${toCategory}`);
};
