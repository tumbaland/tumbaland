import { createActivitySchema, updateActivitySchema } from './schemas';

describe('createActivitySchema', () => {
  it('preserves groupId when the activity is created under a group context', () => {
    const result = createActivitySchema.parse({
      date: '2026-01-01',
      activity: { typeId: 'type-1' },
      groupId: 'group-1'
    });

    expect(result.groupId).toBe('group-1');
  });

  it('omits groupId when creating a personal activity', () => {
    const result = createActivitySchema.parse({
      date: '2026-01-01',
      activity: { typeId: 'type-1' }
    });

    expect(result.groupId).toBeUndefined();
  });
});

describe('updateActivitySchema', () => {
  it('preserves groupId on update', () => {
    const result = updateActivitySchema.parse({ groupId: 'group-1' });

    expect(result.groupId).toBe('group-1');
  });
});
