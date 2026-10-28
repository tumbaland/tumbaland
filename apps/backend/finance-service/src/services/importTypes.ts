/**
 * The two shapes this app reads.
 *
 *   seb        — a bank account statement, the source of the transactions
 *   tumbaland  — an export from this app with the categories edited
 *
 * Named rather than left implicit so a caller can state what it is handing over
 * and be told when the file disagrees, instead of a mis-sniffed statement being
 * quietly read as a category list.
 */
export type TransactionFileFormat = 'seb' | 'tumbaland' | 'pensionikeskus';

export const FORMAT_LABELS: Record<TransactionFileFormat, string> = {
  seb: 'SEB account statement',
  tumbaland: 'Tumbaland export',
  pensionikeskus: 'Pensionikeskus account statement'
};

export interface ImportOptions {
  userId: string;
  groupId?: string;
  userGroups?: string[];
}
