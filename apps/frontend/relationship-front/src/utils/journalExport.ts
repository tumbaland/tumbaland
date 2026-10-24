import { Day } from '../services/types';

/** The journal as CSV, one row per entry. */
export const journalCsv = (days: Day[]): string => {
  const rows = [['Date', 'Activity', 'Description', 'Hours', 'Place', 'Latitude', 'Longitude']];
  for (const day of days) {
    for (const entry of day.entries) {
      rows.push([
        day.date,
        entry.type?.name || '',
        (entry.description || '').replace(/"/g, '""'),
        entry.hours !== undefined && entry.hours !== null ? String(entry.hours) : '',
        (entry.location?.label || '').replace(/"/g, '""'),
        entry.location ? String(entry.location.lat) : '',
        entry.location ? String(entry.location.lng) : ''
      ]);
    }
  }
  return rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
};

/** Hands the browser a file to save. */
export const downloadCsv = (filename: string, csv: string): void => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
