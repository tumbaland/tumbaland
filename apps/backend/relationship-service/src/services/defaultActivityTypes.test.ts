jest.mock('../models/ActivityType', () => ({
  ActivityType: { insertMany: jest.fn() }
}));

import { ActivityType } from '../models/ActivityType';
import { DEFAULT_ACTIVITY_TYPES, seedDefaultActivityTypes } from './defaultActivityTypes';

const mockedInsertMany = ActivityType.insertMany as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedInsertMany.mockResolvedValue(DEFAULT_ACTIVITY_TYPES);
});

describe('DEFAULT_ACTIVITY_TYPES', () => {
  it('covers the three ways an entry can be measured', () => {
    // A new account should be able to describe something, measure something,
    // and mark that something simply happened, without defining a type first.
    const valueTypes = new Set(DEFAULT_ACTIVITY_TYPES.map((type) => type.valueType));
    expect(valueTypes).toContain('string');
    expect(valueTypes).toContain('number');
  });

  it('includes a catch-all, so nothing has to be forced into a wrong type', () => {
    expect(DEFAULT_ACTIVITY_TYPES.map((type) => type.slug)).toContain('other');
  });

  it('has unique slugs, since the database enforces that per scope', () => {
    const slugs = DEFAULT_ACTIVITY_TYPES.map((type) => type.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses slugs the schema will accept', () => {
    for (const type of DEFAULT_ACTIVITY_TYPES) {
      expect(type.slug).toMatch(/^[a-z0-9-]+$/);
      expect(type.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('seedDefaultActivityTypes', () => {
  it('creates every default for a personal scope', async () => {
    await seedDefaultActivityTypes('u1');

    const [documents] = mockedInsertMany.mock.calls[0];
    expect(documents).toHaveLength(DEFAULT_ACTIVITY_TYPES.length);
    expect(documents[0]).toMatchObject({ userId: 'u1', groupId: undefined, sortOrder: 0 });
  });

  it('pins the defaults to a group when one is given', async () => {
    await seedDefaultActivityTypes('u1', 'g1');
    expect(mockedInsertMany.mock.calls[0][0][0]).toMatchObject({ groupId: 'g1' });
  });

  it('orders them, so the list is not arbitrary', async () => {
    await seedDefaultActivityTypes('u1');
    const orders = mockedInsertMany.mock.calls[0][0].map((d: { sortOrder: number }) => d.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('inserts unordered, so one collision does not block the rest', async () => {
    await seedDefaultActivityTypes('u1');
    expect(mockedInsertMany.mock.calls[0][1]).toEqual({ ordered: false });
  });

  it('treats a duplicate key as the desired end state, not a failure', async () => {
    // Two first-requests can race. The unique slug indexes settle it, and the
    // loser should return quietly rather than erroring.
    mockedInsertMany.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(seedDefaultActivityTypes('u1')).resolves.toEqual([]);
  });

  it('still surfaces a real database failure', async () => {
    mockedInsertMany.mockRejectedValue(Object.assign(new Error('connection lost'), { code: 89 }));
    await expect(seedDefaultActivityTypes('u1')).rejects.toThrow('connection lost');
  });
});
