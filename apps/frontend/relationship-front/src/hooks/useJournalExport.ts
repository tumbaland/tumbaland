import { useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { Day } from '../services/types';
import { downloadCsv, journalCsv } from '../utils/journalExport';

/** Bigger pages for the export, so a long history takes few round trips. */
const EXPORT_PAGE_SIZE = 200;

interface UseJournalExportOptions {
  fetchPage: (page: number, pageSize: number) => Promise<{ days: Day[]; totalPages: number }>;
  /** Where a failure is reported; called with null when an export starts. */
  setError: (message: string | null) => void;
}

/**
 * Exports every day matching the current filters, not just the pages already
 * scrolled into view — it re-fetches the full set rather than serialising
 * component state, which would silently export 30 days or 60 depending on
 * how many times "Load older days" had been pressed.
 */
export const useJournalExport = ({ fetchPage, setError }: UseJournalExportOptions) => {
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);

    let allDays: Day[];
    try {
      const first = await fetchPage(1, EXPORT_PAGE_SIZE);
      allDays = first.days;
      for (let nextPage = 2; nextPage <= first.totalPages; nextPage++) {
        allDays = allDays.concat((await fetchPage(nextPage, EXPORT_PAGE_SIZE)).days);
      }
    } catch (e) {
      logger.error('Failed to export the journal', e);
      setError('Failed to export the journal');
      setExporting(false);
      return;
    }

    downloadCsv('journal_export.csv', journalCsv(allDays));
    setExporting(false);
  };

  return { exporting, exportCsv };
};
