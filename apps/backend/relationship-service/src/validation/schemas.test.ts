import {
  createActivitySchema,
  updateActivitySchema,
  saveDaySchema,
  saveDashboardSettingsSchema
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
});

describe('updateActivitySchema', () => {
  it('preserves groupId on update', () => {
    const result = updateActivitySchema.parse({ groupId: 'group-1' });

    expect(result.groupId).toBe('group-1');
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
      entries: [{ typeId: 't1', location: { label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 } }]
    });
    expect(result.entries[0].location).toEqual({ label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 });
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
