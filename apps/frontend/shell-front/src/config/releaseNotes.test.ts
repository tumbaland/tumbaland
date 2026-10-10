import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  APP_VERSION,
  RECENT_NOTES,
  RECENT_NOTES_LIMIT,
  RELEASE_NOTES,
  groupByDate,
  parseNotes
} from './releaseNotes';

const FOLDER = join(__dirname, '..', 'release-notes');
const files = readdirSync(FOLDER).filter((name) => name.endsWith('.json'));

describe('the files in release-notes/', () => {
  it('has some', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is a valid note in plain copy', (name) => {
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.json$/);

    const note = JSON.parse(readFileSync(join(FOLDER, name), 'utf8')) as { date: unknown; items: unknown };
    expect(Object.keys(note).sort()).toEqual(['date', 'items']);

    // The name and the date say the same day, and it is a day that exists.
    expect(note.date).toBe(name.slice(0, 10));
    expect(new Date(`${note.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(note.date);

    expect(Array.isArray(note.items)).toBe(true);
    const items = note.items as string[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item).toBe('string');
      expect(item.trim()).toBe(item);
      expect(item).not.toBe('');
      expect(item).not.toMatch(/[—–]/);
    }
  });

  it('are all picked up by the app', () => {
    expect(RELEASE_NOTES).toHaveLength(files.length);
  });
});

describe('parseNotes', () => {
  const note = (date: string, items = ['x']) => ({ date, items });

  it('orders newest first, then by id', () => {
    const notes = parseNotes({
      '../release-notes/2026-01-02-a.json': note('2026-01-02'),
      '../release-notes/2026-03-01-a.json': note('2026-03-01'),
      '../release-notes/2026-01-02-b.json': note('2026-01-02')
    });
    expect(notes.map((n) => n.id)).toEqual(['2026-03-01-a', '2026-01-02-b', '2026-01-02-a']);
  });

  it('leaves out a file that is not a note instead of failing', () => {
    const notes = parseNotes({
      '../release-notes/ok.json': note('2026-01-02'),
      '../release-notes/no-items.json': note('2026-01-02', []),
      '../release-notes/blank.json': note('2026-01-02', ['  ']),
      '../release-notes/bad-date.json': note('Oct 3'),
      '../release-notes/not-an-object.json': 'hello',
      '../release-notes/null.json': null
    });
    expect(notes.map((n) => n.id)).toEqual(['ok']);
  });
});

describe('groupByDate', () => {
  it('puts the changes of one day under one heading, keeping the order', () => {
    const days = groupByDate([
      { id: 'b', date: '2026-02-01', items: ['three'] },
      { id: 'a', date: '2026-01-02', items: ['one', 'two'] },
      { id: 'c', date: '2026-01-02', items: ['four'] }
    ]);
    expect(days).toEqual([
      { date: '2026-02-01', items: ['three'] },
      { date: '2026-01-02', items: ['one', 'two', 'four'] }
    ]);
  });

  it('does not change the notes it was given', () => {
    const notes = [
      { id: 'a', date: '2026-01-02', items: ['one'] },
      { id: 'b', date: '2026-01-02', items: ['two'] }
    ];
    groupByDate(notes);
    expect(notes[0]!.items).toEqual(['one']);
  });
});

it('lists no more than the limit', () => {
  expect(RECENT_NOTES.length).toBeLessThanOrEqual(RECENT_NOTES_LIMIT);
});

it('knows the version it was built from', () => {
  expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
});
