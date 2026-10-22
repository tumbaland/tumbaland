import { describe, expect, it } from 'vite-plus/test';
import { messageSummary } from './summary';

const file = (mimetype: string) => ({ fileId: mimetype, mimetype, sizeBytes: 1 });
const base = { body: '', attachments: [], collage: null, plan: null };

describe('messageSummary', () => {
  it('names a collage and a reminder by their titles', () => {
    expect(messageSummary({ ...base, collage: { id: 'k', title: 'Rome' } })).toBe('Collage: Rome');
    expect(
      messageSummary({
        ...base,
        plan: { id: 'p', title: 'Concert', date: '2026-10-30', time: null, timeZone: 'Europe/Tallinn', place: null }
      })
    ).toBe('Reminder: Concert');
  });

  it('uses the text when there is some', () => {
    expect(messageSummary({ ...base, body: '  see you at six  ', attachments: [file('image/jpeg')] })).toBe('see you at six');
  });

  it.each([
    ['image/jpeg', 'Photo'],
    ['video/mp4', 'Video'],
    ['audio/webm', 'Voice message'],
    ['application/pdf', 'Document']
  ])('calls a lone %s a %s', (mimetype, summary) => {
    expect(messageSummary({ ...base, attachments: [file(mimetype)] })).toBe(summary);
  });

  it('counts several attachments, and says nothing for none', () => {
    expect(messageSummary({ ...base, attachments: [file('image/jpeg'), file('image/png')] })).toBe('2 attachments');
    expect(messageSummary(base)).toBe('');
  });
});
