import {
  createActivitySchema,
  updateActivitySchema,
  saveDaySchema,
  saveDashboardSettingsSchema,
  createPlanSchema,
  updatePlanSchema
} from './schemas';

describe('createActivitySchema', () => {
  it('preserves groupId when the activity is created under a group context', () => {
    const result = createActivitySchema.parse({
      date: '2026-01-01',
      typeId: 'type-1',
      groupId: 'group-1'
    });

    expect(result.groupId).toBe('group-1');
  });

  it('omits groupId when creating a personal activity', () => {
    const result = createActivitySchema.parse({
      date: '2026-01-01',
      typeId: 'type-1'
    });

    expect(result.groupId).toBeUndefined();
  });

  it('rejects a missing typeId', () => {
    expect(() => createActivitySchema.parse({ date: '2026-01-01' })).toThrow();
  });

  it('stores the day as its UTC midnight', () => {
    const result = createActivitySchema.parse({ date: '2026-01-01', typeId: 'type-1' });

    expect(result.date.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it.each([
    ['a timestamp', 1767225600000, 'A valid date is required'],
    ['a full ISO datetime', '2026-01-01T15:00:00Z', 'Date must be formatted as YYYY-MM-DD'],
    ['a day that rolls into the next month', '2026-02-31', 'Invalid date'],
    ['a missing date', undefined, 'A valid date is required']
  ])('rejects %s', (_label, date, message) => {
    const result = createActivitySchema.safeParse({ date, typeId: 'type-1' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe('updateActivitySchema', () => {
  it('preserves groupId on update', () => {
    const result = updateActivitySchema.parse({ groupId: 'group-1' });

    expect(result.groupId).toBe('group-1');
  });

  it('leaves the date alone when an update does not move the entry', () => {
    const result = updateActivitySchema.parse({ description: 'Padel' });

    expect(result).not.toHaveProperty('date');
  });

  it('rejects moving an entry to a day that does not exist', () => {
    expect(() => updateActivitySchema.parse({ date: '2025-02-29' })).toThrow('Invalid date');
  });
});

describe('saveDaySchema', () => {
  it('accepts a mix of existing and new entries', () => {
    const result = saveDaySchema.parse({
      entries: [
        { _id: 'a1', typeId: 'type-1', hours: 5 },
        { typeId: 'type-2', description: 'Padel' }
      ],
      groupId: 'group-1'
    });

    expect(result.entries).toHaveLength(2);
    expect(result.groupId).toBe('group-1');
  });

  it('accepts an empty entries list (clears the day)', () => {
    const result = saveDaySchema.parse({ entries: [] });
    expect(result.entries).toEqual([]);
  });

  it('rejects entries without a typeId', () => {
    expect(() => saveDaySchema.parse({ entries: [{ description: 'x' }] })).toThrow();
  });

  it('accepts an entry carrying a location', () => {
    const result = saveDaySchema.parse({
      entries: [{ typeId: 't1', location: { label: 'Sushi House', lat: 59.4405, lng: 24.7453 } }]
    });
    expect(result.entries[0].location).toEqual({ label: 'Sushi House', lat: 59.4405, lng: 24.7453 });
  });

  it('accepts a null location, which clears a previously saved place', () => {
    const result = saveDaySchema.parse({ entries: [{ typeId: 't1', location: null }] });
    expect(result.entries[0].location).toBeNull();
  });

  it.each([
    ['an unnamed place', { label: '   ', lat: 0, lng: 0 }],
    ['an out-of-range latitude', { label: 'x', lat: 91, lng: 0 }],
    ['an out-of-range longitude', { label: 'x', lat: 0, lng: -181 }],
    ['a missing coordinate', { label: 'x', lat: 0 }]
  ])('rejects %s', (_case, location) => {
    expect(() => saveDaySchema.parse({ entries: [{ typeId: 't1', location }] })).toThrow();
  });
});

describe('saveDashboardSettingsSchema', () => {
  it('accepts highlight and hidden type lists with a group scope', () => {
    const result = saveDashboardSettingsSchema.parse({
      highlightTypeIds: ['t1'],
      hiddenTypeIds: ['t2', 't3'],
      groupId: 'group-1'
    });

    expect(result.highlightTypeIds).toEqual(['t1']);
    expect(result.groupId).toBe('group-1');
  });

  it('requires both lists to be present', () => {
    expect(() => saveDashboardSettingsSchema.parse({ highlightTypeIds: [] })).toThrow();
  });

  it('accepts a YYYY-MM-DD start date, and an empty one meaning "no override"', () => {
    const base = { highlightTypeIds: [], hiddenTypeIds: [] };

    expect(saveDashboardSettingsSchema.parse({ ...base, startDate: '2024-01-18' }).startDate).toBe('2024-01-18');
    expect(saveDashboardSettingsSchema.parse({ ...base, startDate: '' }).startDate).toBe('');
    expect(saveDashboardSettingsSchema.parse({ ...base, startDate: null }).startDate).toBeNull();
    expect(saveDashboardSettingsSchema.parse(base).startDate).toBeUndefined();
  });

  it('rejects a start date that is not a plain day', () => {
    expect(() =>
      saveDashboardSettingsSchema.parse({
        highlightTypeIds: [],
        hiddenTypeIds: [],
        startDate: '2024-01-18T00:00:00Z'
      })
    ).toThrow();
  });
});

describe('plan schemas', () => {
  it('takes a trip that ends after it starts, and refuses one that ends before', () => {
    expect(createPlanSchema.safeParse({ title: 'Rome', date: '2030-06-01', endDate: '2030-06-05' }).success).toBe(true);
    const backwards = createPlanSchema.safeParse({ title: 'Rome', date: '2030-06-05', endDate: '2030-06-01' });
    expect(backwards.success).toBe(false);
    expect(backwards.error?.issues[0]?.message).toBe('A plan ends on or after the day it starts');
    expect(updatePlanSchema.safeParse({ date: '2030-06-05', endDate: '2030-06-01' }).success).toBe(false);
    expect(updatePlanSchema.safeParse({ endDate: '2030-06-01' }).success).toBe(true);
  });

  it('refuses a made-up time zone and a 12-hour time', () => {
    expect(createPlanSchema.safeParse({ title: 'x', date: '2030-06-01', timeZone: 'Mars/Olympus' }).success).toBe(false);
    expect(createPlanSchema.safeParse({ title: 'x', date: '2030-06-01', time: '7pm' }).success).toBe(false);
  });
});
