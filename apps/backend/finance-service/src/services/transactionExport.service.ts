import Transaction from '../models/Transaction';
import { buildFilter, TransactionQuery } from './transaction.service';

/**
 * Columns of the export, and the contract the re-import relies on.
 *
 * `id` is what a returning file is matched on: it is stable, unique, and
 * survives a trip through a spreadsheet unchanged. Everything else is context
 * for whoever is doing the categorising — only `category` is read back.
 */
export const EXPORT_COLUMNS = ['id', 'date', 'type', 'amount', 'category', 'note'] as const;

/** Cap on one export, so a runaway filter cannot try to stream the whole history twice over. */
export const MAX_EXPORT_ROWS = 20000;

/**
 * Semicolon separated with comma decimals, matching the bank exports this app
 * already reads and the separator a European spreadsheet expects. A file that
 * opens as one column of text in Excel does not get categorised.
 */
const DELIMITER = ';';

function escapeCell(value: string): string {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Record<string, string>>, columns: readonly string[]): string {
  const header = columns.join(DELIMITER);
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c])).join(DELIMITER));
  // A BOM so Excel reads it as UTF-8 rather than mangling every ä and õ.
  return `\uFEFF${[header, ...body].join('\n')}\n`;
}

export interface ExportResult {
  csv: string;
  rows: number;
  /** Suggested file name, describing the filter so exports do not all collide. */
  filename: string;
}

function describeFilter(query: TransactionQuery): string {
  const parts: string[] = [];
  if (query.category) parts.push(query.category.toLowerCase().replace(/\s+/g, '-'));
  if (query.type) parts.push(query.type);
  if (query.search) parts.push(query.search.toLowerCase().replace(/\s+/g, '-').slice(0, 20));
  if (query.from) parts.push(`from-${query.from.toISOString().slice(0, 10)}`);
  if (query.to) parts.push(`to-${query.to.toISOString().slice(0, 10)}`);
  return parts.length > 0 ? parts.join('_') : 'all';
}

/**
 * Export the transactions a filter matches, for categorising elsewhere.
 *
 * Deliberately honours the same filter as the table: the point is to pull out
 * the uncategorised rows, sort them in a spreadsheet, and hand the file back.
 */
export const exportTransactions = async (
  userId: string,
  userGroups: string[] = [],
  query: TransactionQuery = {}
): Promise<ExportResult> => {
  const filter = buildFilter(userId, userGroups, query);

  const transactions = await Transaction.find(filter)
    .sort({ date: -1, _id: -1 })
    .limit(MAX_EXPORT_ROWS)
    .lean();

  const rows = transactions.map((t) => ({
    id: String(t._id),
    date: t.date.toISOString().slice(0, 10),
    type: t.type,
    // Comma decimals, matching the delimiter choice above
    amount: t.amount.toFixed(2).replace('.', ','),
    category: t.category,
    note: t.note || ''
  }));

  return {
    csv: toCsv(rows, EXPORT_COLUMNS),
    rows: rows.length,
    filename: `transactions_${describeFilter(query)}.csv`
  };
};
