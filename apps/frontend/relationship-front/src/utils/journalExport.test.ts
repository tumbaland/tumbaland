import { describe, expect, it } from 'vite-plus/test';
import type { Day } from '../services/types';
import { journalCsv } from './journalExport';

const day = (entries: Array<Record<string, unknown>>): Day => ({ date: '2026-10-01', entries }) as unknown as Day;

describe('journalCsv', () => {
  it('starts with the header row', () => {
    expect(journalCsv([]).split('\n')[0]).toBe('"Date","Activity","Description","Hours","Place","Latitude","Longitude"');
  });

  it('writes one row per entry, with the place when there is one', () => {
    const csv = journalCsv([
      day([
        { type: { name: 'Walk' }, description: 'By the sea', hours: 2, location: { label: 'Pirita', lat: 59.47, lng: 24.83 } },
        { type: { name: 'Movie' } }
      ])
    ]);

    expect(csv.split('\n').slice(1)).toEqual([
      '"2026-10-01","Walk","By the sea","2","Pirita","59.47","24.83"',
      '"2026-10-01","Movie","","","","",""'
    ]);
  });

  it('doubles quotes inside a field so the row stays one row', () => {
    const csv = journalCsv([day([{ type: { name: 'Dinner' }, description: 'She said "wow"' }])]);

    expect(csv).toContain('"She said ""wow"""');
  });

  it('keeps an hours value of zero', () => {
    expect(journalCsv([day([{ type: { name: 'Rest' }, hours: 0 }])])).toContain('"0"');
  });
});
