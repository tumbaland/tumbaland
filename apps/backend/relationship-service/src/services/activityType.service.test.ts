jest.mock('../models/ActivityType', () => {
  const ActivityType = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: 'new-id' })
  })) as jest.Mock & Record<string, jest.Mock>;
  ActivityType.findOne = jest.fn();
  ActivityType.find = jest.fn();
  ActivityType.findById = jest.fn();
  ActivityType.findByIdAndUpdate = jest.fn();
  ActivityType.findByIdAndDelete = jest.fn();
  ActivityType.countDocuments = jest.fn();
  ActivityType.bulkWrite = jest.fn();
  // An empty scope now seeds defaults on first read, so the query path reaches
  // insertMany. Resolving empty keeps these tests about scoping, not seeding.
  ActivityType.insertMany = jest.fn().mockResolvedValue([]);
  return { ActivityType };
});

import { ActivityType } from '../models/ActivityType';
import {
  createActivityType,
  getActivityTypes,
  getActivityTypeById,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes
} from './activityType.service';

const mockedCtor = ActivityType as unknown as jest.Mock;
const mockedFindOne = ActivityType.findOne as unknown as jest.Mock;
const mockedFind = ActivityType.find as unknown as jest.Mock;
const mockedFindById = ActivityType.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = ActivityType.findByIdAndUpdate as unknown as jest.Mock;
const mockedCountDocuments = ActivityType.countDocuments as unknown as jest.Mock;
const mockedBulkWrite = ActivityType.bulkWrite as unknown as jest.Mock;

// ActivityType.find(...).sort(...).skip(...).limit(...).lean()
const mockFindChain = (docs: unknown[]) => ({
  sort: jest.fn().mockReturnValue({
    skip: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(docs)
      })
    })
  })
});

beforeEach(() => jest.clearAllMocks());

describe('createActivityType', () => {
  it('throws when the slug already exists in the same scope', async () => {
    mockedFindOne.mockResolvedValue({ _id: 'existing' });

    await expect(createActivityType({ slug: 'reading', userId: 'u1' })).rejects.toMatchObject({
      name: 'ConflictError'
    });
    expect(mockedCtor).not.toHaveBeenCalled();
  });

  it('creates and returns the new type when the slug is free', async () => {
    mockedFindOne.mockResolvedValue(null);

    const result = await createActivityType({ slug: 'reading', name: 'Reading' });

    expect(mockedCtor).toHaveBeenCalledWith({ slug: 'reading', name: 'Reading' });
    expect(result).toMatchObject({ slug: 'reading', name: 'Reading' });
  });

  it('checks a personal slug against that user only, not the whole collection', async () => {
    mockedFindOne.mockResolvedValue(null);

    await createActivityType({ slug: 'movies', name: 'Movies', userId: 'u1' });

    expect(mockedFindOne).toHaveBeenCalledWith({
      slug: 'movies',
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });

  it('checks a group slug against that group only', async () => {
    mockedFindOne.mockResolvedValue(null);

    await createActivityType({ slug: 'movies', name: 'Movies', userId: 'u1', groupId: 'g1' });

    expect(mockedFindOne).toHaveBeenCalledWith({ slug: 'movies', groupId: 'g1' });
  });

  it('lets a second user create a slug the first user already uses', async () => {
    // No document matches the second user's scope, so the create goes through.
    mockedFindOne.mockResolvedValue(null);

    await expect(
      createActivityType({ slug: 'movies', name: 'Movies', userId: 'u2' })
    ).resolves.toMatchObject({ slug: 'movies' });
    expect(mockedFindOne).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
  });
});

describe('getActivityTypes', () => {
  describe('seeding an empty scope', () => {
    const mockedInsertMany = (ActivityType as unknown as { insertMany: jest.Mock }).insertMany;

    it('seeds personal types under the user, with no group', async () => {
      mockedFind.mockReturnValue(mockFindChain([]));
      mockedCountDocuments.mockResolvedValue(0);
      mockedInsertMany.mockResolvedValue([{ slug: 'dining' }]);

      await getActivityTypes({ userId: 'u1' });

      const [documents] = mockedInsertMany.mock.calls[0];
      // Absent rather than null: the personal uniqueness index is
      // `(userId, slug)` filtered on `groupId: null`, which matches a missing
      // field — so these are unique per user.
      expect(documents.every((d: { userId?: string }) => d.userId === 'u1')).toBe(true);
      expect(documents.every((d: { groupId?: string }) => d.groupId === undefined)).toBe(true);
    });

    it('seeds group types under the group, so they are unique per group', async () => {
      mockedFind.mockReturnValue(mockFindChain([]));
      mockedCountDocuments.mockResolvedValue(0);
      mockedInsertMany.mockResolvedValue([{ slug: 'dining' }]);

      await getActivityTypes({ userId: 'u1', groupId: 'g1' });

      expect(mockedInsertMany.mock.calls[0][0].every((d: { groupId?: string }) => d.groupId === 'g1')).toBe(true);
    });

    it('does not seed when the scope already has types', async () => {
      mockedFind.mockReturnValue(mockFindChain([{ slug: 'dining' }]));
      mockedCountDocuments.mockResolvedValue(1);

      await getActivityTypes({ userId: 'u1' });

      expect(mockedInsertMany).not.toHaveBeenCalled();
    });

    it('does not seed a group whose members already have personal types', async () => {
      // Group context counts personal types as a fallback, so a user who
      // already has their own set makes the group non-empty — and seeding it
      // anyway would show every name twice.
      mockedFind.mockReturnValue(mockFindChain([{ slug: 'dining' }]));
      mockedCountDocuments.mockResolvedValue(7);

      await getActivityTypes({ userId: 'u1', groupId: 'g1' });

      expect(mockedInsertMany).not.toHaveBeenCalled();
    });

    it('only seeds from the first page, since a later empty page means nothing', async () => {
      mockedFind.mockReturnValue(mockFindChain([]));
      mockedCountDocuments.mockResolvedValue(0);

      await getActivityTypes({ userId: 'u1', page: 3 });

      expect(mockedInsertMany).not.toHaveBeenCalled();
    });

    it('needs a user, so an unscoped call never writes', async () => {
      mockedFind.mockReturnValue(mockFindChain([]));
      mockedCountDocuments.mockResolvedValue(0);

      await expect(getActivityTypes({})).rejects.toThrow();

      expect(mockedInsertMany).not.toHaveBeenCalled();
    });
  });

  it("scopes to the group's own types, never the caller's personal ones", async () => {
    // A personal type offered inside a group gets recorded against, and the
    // resulting entries are invisible to everyone else in the group and break
    // when their owner deletes the type.
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    await getActivityTypes({ userId: 'u1', groupId: 'g1' });

    expect(mockedFind).toHaveBeenCalledWith({
      isActive: true,
      groupId: 'g1'
    });
  });

  it('scopes to personal-only when groupId is explicitly null', async () => {
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    await getActivityTypes({ userId: 'u1', groupId: null as never });

    expect(mockedFind).toHaveBeenCalledWith({
      isActive: true,
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });

  it('defaults to personal context when no groupId is given but a userId is', async () => {
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    await getActivityTypes({ userId: 'u1' });

    expect(mockedFind).toHaveBeenCalledWith({
      isActive: true,
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });

  it('refuses when neither userId nor groupId is given, rather than reading everything', async () => {
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    // This used to answer with every active type in the database — one
    // account's list built from all of them. It hid a real fault for as long as
    // it stood: an OAuth access token read as a session left `userId`
    // undefined, and the listing looked correct right up until the first write.
    await expect(getActivityTypes({})).rejects.toThrow('without a user');
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('computes pagination from the total count', async () => {
    mockedFind.mockReturnValue(mockFindChain([{ _id: 't1' }]));
    mockedCountDocuments.mockResolvedValue(25);

    const result = await getActivityTypes({ userId: 'u1', limit: 10, page: 2 });

    expect(result).toEqual({ types: [{ _id: 't1' }], total: 25, page: 2, totalPages: 3 });
  });
});

describe('getActivityTypeById', () => {
  it('delegates to findById', async () => {
    mockedFindById.mockResolvedValue({ _id: 't1' });
    expect(await getActivityTypeById('t1')).toEqual({ _id: 't1' });
    expect(mockedFindById).toHaveBeenCalledWith('t1');
  });
});

describe('updateActivityType', () => {
  // ActivityType.findById(...).select('userId groupId') resolves the stored scope.
  const mockStoredScope = (scope: Record<string, unknown> | null) => {
    mockedFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(scope) });
  };

  it('throws when the new slug collides within the same scope', async () => {
    mockStoredScope({ userId: 'u1' });
    mockedFindOne.mockResolvedValue({ _id: 'other' });

    await expect(updateActivityType('t1', { slug: 'taken' })).rejects.toMatchObject({ name: 'ConflictError' });
    expect(mockedFindOne).toHaveBeenCalledWith({
      slug: 'taken',
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }],
      _id: { $ne: 't1' }
    });
    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('checks a group type\'s slug within its group only', async () => {
    mockStoredScope({ userId: 'u1', groupId: 'g1' });
    mockedFindOne.mockResolvedValue(null);
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 't1' });

    await updateActivityType('t1', { slug: 'movies' });

    expect(mockedFindOne).toHaveBeenCalledWith({ slug: 'movies', groupId: 'g1', _id: { $ne: 't1' } });
  });

  it('returns null when the type being updated no longer exists', async () => {
    mockStoredScope(null);

    await expect(updateActivityType('gone', { slug: 'x' })).resolves.toBeNull();
    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates when the slug is free or unchanged', async () => {
    mockStoredScope({ userId: 'u1' });
    mockedFindOne.mockResolvedValue(null);
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 't1', slug: 'reading' });

    const result = await updateActivityType('t1', { slug: 'reading' });

    expect(result).toEqual({ _id: 't1', slug: 'reading' });
  });

  it('skips the uniqueness check when the slug is not being updated', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 't1', name: 'New name' });

    await updateActivityType('t1', { name: 'New name' });

    expect(mockedFindOne).not.toHaveBeenCalled();
  });
});

describe('deleteActivityType', () => {
  it('soft-deletes by returning true when a document was updated', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 't1' });
    expect(await deleteActivityType('t1')).toBe(true);
    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('t1', { isActive: false });
  });

  it('returns false when nothing was found', async () => {
    mockedFindByIdAndUpdate.mockResolvedValue(null);
    expect(await deleteActivityType('missing')).toBe(false);
  });
});

describe('reorderActivityTypes', () => {
  it('builds a bulk update scoped to the user and personal context', async () => {
    mockedBulkWrite.mockResolvedValue({});

    await reorderActivityTypes(['t1', 't2'], 'u1');

    expect(mockedBulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: 't1', userId: 'u1', groupId: { $exists: false } }, update: { sortOrder: 0 } } },
      { updateOne: { filter: { _id: 't2', userId: 'u1', groupId: { $exists: false } }, update: { sortOrder: 1 } } }
    ]);
  });

  it('scopes to the group when groupId is given', async () => {
    mockedBulkWrite.mockResolvedValue({});

    await reorderActivityTypes(['t1'], 'u1', 'g1');

    expect(mockedBulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: 't1', userId: 'u1', groupId: 'g1' }, update: { sortOrder: 0 } } }
    ]);
  });
});
