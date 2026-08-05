import { Activity } from './Activity';

const indexes = Activity.schema.indexes();
const findIndex = (key: Record<string, unknown>) =>
  indexes.find(([fields]) => JSON.stringify(fields) === JSON.stringify(key));

describe('Activity validation', () => {
  it('rejects fractional hours', () => {
    const doc = new Activity({ date: new Date(), typeId: '507f1f77bcf86cd799439011', userId: 'u1', hours: 1.5 });
    expect(doc.validateSync()?.errors.hours?.message).toBe('Hours must be an integer');
  });

  it('rejects a location outside the valid coordinate range', () => {
    const doc = new Activity({
      date: new Date(),
      typeId: '507f1f77bcf86cd799439011',
      userId: 'u1',
      location: { label: 'Nowhere', lat: 91, lng: 200 }
    });
    const err = doc.validateSync();
    expect(err?.errors['location.lat']).toBeDefined();
    expect(err?.errors['location.lng']).toBeDefined();
  });

  it('rejects a location with no name', () => {
    const doc = new Activity({
      date: new Date(),
      typeId: '507f1f77bcf86cd799439011',
      userId: 'u1',
      location: { lat: 59.4405, lng: 24.7453 }
    });
    expect(doc.validateSync()?.errors['location.label']).toBeDefined();
  });

  it('accepts a well-formed location', () => {
    const doc = new Activity({
      date: new Date(),
      typeId: '507f1f77bcf86cd799439011',
      userId: 'u1',
      location: { label: 'Kolm Sõsarat', lat: 59.4405, lng: 24.7453 }
    });
    expect(doc.validateSync()?.errors.location).toBeUndefined();
  });

  it('accepts an entry with no location at all', () => {
    const doc = new Activity({ date: new Date(), typeId: '507f1f77bcf86cd799439011', userId: 'u1' });
    expect(doc.validateSync()).toBeUndefined();
  });
});

describe('Activity indexes', () => {
  // Every scoped read filters on the tenancy field and sorts on a date, so an
  // index that does not lead with userId/groupId can serve neither branch of
  // buildAccessQuery's $or and the sort spills to an in-memory sort.
  it.each([
    ['userId', 'date'],
    ['groupId', 'date'],
    ['userId', 'createdAt'],
    ['groupId', 'createdAt']
  ])('leads with %s before sorting on %s', (tenancyField, sortField) => {
    expect(findIndex({ [tenancyField]: 1, [sortField]: -1 })).toBeDefined();
  });

  it('indexes located entries sparsely, per scope', () => {
    for (const tenancyField of ['userId', 'groupId']) {
      const [, options] = findIndex({ [tenancyField]: 1, 'location.label': 1 }) ?? [];
      expect(options?.sparse).toBe(true);
    }
  });
});
