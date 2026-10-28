import { dayHeading, displayValue, resourceName, summarize, toolCost, withArticle } from './activityFormat';

describe('displayValue', () => {
  it('spells out absence', () => {
    expect(displayValue(null)).toBe('nothing');
    expect(displayValue(undefined)).toBe('nothing');
    expect(displayValue('')).toBe('nothing');
  });

  it('quotes text and writes dates as dates', () => {
    expect(displayValue('dinner')).toBe('“dinner”');
    expect(displayValue('2026-10-13T10:00:00.000Z')).toBe(
      new Date('2026-10-13T10:00:00.000Z').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    );
  });

  it('writes numbers and objects plainly', () => {
    expect(displayValue(3)).toBe('3');
    expect(displayValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('summarize', () => {
  it('lists the fields worth showing, in reading order, skipping blanks', () => {
    expect(summarize({ name: 'Rome', hours: 2, description: 'Walk', date: '' })).toBe('“Walk” · 2h · “Rome”');
  });
});

it('names a resource in the singular, without underscores', () => {
  expect(resourceName('activities')).toBe('activity');
  expect(resourceName('photos')).toBe('photo');
  expect(resourceName('activity_types')).toBe('activity type');
});

it('puts the right article in front of a noun', () => {
  expect(withArticle('activity')).toBe('an activity');
  expect(withArticle('photo')).toBe('a photo');
});

it('writes a tool call as tokens and milliseconds', () => {
  expect(toolCost({ tokens: 12000, ms: 85 } as never)).toBe(`~${(12000).toLocaleString()} tokens · 85 ms`);
});

describe('dayHeading', () => {
  it('says Today and Yesterday, and names other days', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    expect(dayHeading(now.toISOString())).toBe('Today');
    expect(dayHeading(yesterday.toISOString())).toBe('Yesterday');
    expect(dayHeading('2020-03-04T12:00:00.000Z')).not.toMatch(/Today|Yesterday/);
  });
});
