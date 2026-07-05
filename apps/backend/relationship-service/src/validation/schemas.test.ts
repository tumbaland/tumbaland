import { createActivitySchema, updateActivitySchema, saveDaySchema } from './schemas';

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
});
