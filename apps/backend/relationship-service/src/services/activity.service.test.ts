jest.mock('../models/Activity', () => {
  const Activity = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: 'new-id' })
  })) as jest.Mock & Record<string, jest.Mock>;
  Activity.find = jest.fn();
  Activity.countDocuments = jest.fn();
  Activity.findOne = jest.fn();
  Activity.findOneAndUpdate = jest.fn();
  Activity.findOneAndDelete = jest.fn();
  Activity.distinct = jest.fn();
  return { Activity };
});

jest.mock('../models/ActivityType', () => ({
  ActivityType: { findOne: jest.fn(), find: jest.fn() }
}));

import { Activity } from '../models/Activity';
import { ActivityType } from '../models/ActivityType';
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivityTypes,
  getDescriptionsByTypeId
} from './activity.service';

const mockedCtor = Activity as unknown as jest.Mock;
const mockedFind = Activity.find as unknown as jest.Mock;
const mockedCountDocuments = Activity.countDocuments as unknown as jest.Mock;
const mockedFindOne = Activity.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = Activity.findOneAndUpdate as unknown as jest.Mock;
const mockedFindOneAndDelete = Activity.findOneAndDelete as unknown as jest.Mock;
const mockedDistinct = Activity.distinct as unknown as jest.Mock;
const mockedTypeFindOne = ActivityType.findOne as jest.Mock;
const mockedTypeFind = ActivityType.find as jest.Mock;

// Activity.find(query).populate('typeId').sort(...).skip(...).limit(...)
const mockFindChain = (docs: unknown[]) => ({
  populate: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(docs)
      })
    })
  })
});

beforeEach(() => jest.clearAllMocks());

describe('createActivity', () => {
  it('saves and returns the new activity', async () => {
    const result = await createActivity({ description: 'run' });
    expect(mockedCtor).toHaveBeenCalledWith({ description: 'run' });
    expect(result).toMatchObject({ description: 'run' });
  });
});

describe('getActivities', () => {
  it('returns empty results when the activityType slug does not resolve', async () => {
    mockedTypeFindOne.mockResolvedValue(null);

    const result = await getActivities({ activityType: 'unknown' });

    expect(result).toEqual({ activities: [], total: 0, page: 1, totalPages: 0 });
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('filters by resolved activity type, date range and description', async () => {
    mockedTypeFindOne.mockResolvedValue({ _id: 'type-1' });
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    await getActivities({
      activityType: 'reading',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
      description: 'book'
    });

    expect(mockedFind).toHaveBeenCalledWith({
      typeId: 'type-1',
      date: { $gte: new Date('2024-01-01'), $lte: new Date('2024-02-01') },
      description: { $regex: 'book', $options: 'i' }
    });
  });

  it('denies access to a group the user is not a member of', async () => {
    await expect(getActivities({ groupId: 'g9', userGroupIds: [] })).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('scopes to the group when access is allowed', async () => {
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    await getActivities({ groupId: 'g1', userGroupIds: ['g1'] });

    expect(mockedFind).toHaveBeenCalledWith({ groupId: 'g1' });
  });

  it('scopes to personal-only items when only userId is given', async () => {
    mockedFind.mockReturnValue(mockFindChain([]));
    mockedCountDocuments.mockResolvedValue(0);

    await getActivities({ userId: 'u1' });

    expect(mockedFind).toHaveBeenCalledWith({
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });

  it.each([
    ['hours', { hours: -1 }],
    ['description', { description: -1 }],
    ['createdAt', { createdAt: -1 }],
    ['bogus', { date: -1 }]
  ])('maps sortBy=%s to the expected sort object', async (sortBy, expectedSort) => {
    const chain = mockFindChain([]);
    mockedFind.mockReturnValue(chain);
    mockedCountDocuments.mockResolvedValue(0);

    await getActivities({ sortBy, sortOrder: 'desc' });

    expect(chain.populate().sort).toHaveBeenCalledWith(expectedSort);
  });

  it('computes pagination from total and limit', async () => {
    mockedFind.mockReturnValue(mockFindChain([{ _id: 'a1' }]));
    mockedCountDocuments.mockResolvedValue(45);

    const result = await getActivities({ limit: 20, page: 2 });

    expect(result).toEqual({ activities: [{ _id: 'a1' }], total: 45, page: 2, totalPages: 3 });
  });
});

describe('getActivityById / updateActivity / deleteActivity', () => {
  /**
   * These three took an id and nothing else, so any signed-in caller could read,
   * rewrite or delete any other account's entry by naming its id. The scope is
   * asserted on every one of them rather than on a representative sample: the
   * whole failure was that one of them was written without it.
   */
  const ownScope = { $or: [{ userId: 'u1' }, { groupId: { $in: ['g1'] } }] };

  it('getActivityById only reaches entries the caller can see', async () => {
    mockedFindOne.mockResolvedValue({ _id: 'a1' });

    expect(await getActivityById('a1', 'u1', ['g1'])).toEqual({ _id: 'a1' });
    expect(mockedFindOne).toHaveBeenCalledWith({ _id: 'a1', ...ownScope });
  });

  it('updateActivity only rewrites entries the caller can see, with validators', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ _id: 'a1', hours: 2 });

    const result = await updateActivity('a1', { hours: 2 }, 'u1', ['g1']);

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'a1', ...ownScope },
      { hours: 2 },
      { new: true, runValidators: true }
    );
    expect(result).toEqual({ _id: 'a1', hours: 2 });
  });

  it('updateActivity reports a miss rather than touching another account', async () => {
    mockedFindOneAndUpdate.mockResolvedValue(null);
    expect(await updateActivity('someone-elses', { hours: 2 }, 'u1', ['g1'])).toBeNull();
  });

  it('deleteActivity only reaches entries the caller can see', async () => {
    mockedFindOneAndDelete.mockResolvedValue({ _id: 'a1' });

    expect(await deleteActivity('a1', 'u1', ['g1'])).toBe(true);
    expect(mockedFindOneAndDelete).toHaveBeenCalledWith({ _id: 'a1', ...ownScope });
  });

  it('deleteActivity returns false when nothing in scope was found', async () => {
    mockedFindOneAndDelete.mockResolvedValue(null);
    expect(await deleteActivity('missing', 'u1', [])).toBe(false);
  });

  it('a caller in no groups reaches only their own entries', async () => {
    mockedFindOne.mockResolvedValue(null);

    await getActivityById('a1', 'u1');

    expect(mockedFindOne).toHaveBeenCalledWith({
      _id: 'a1',
      $or: [{ userId: 'u1' }, { groupId: { $in: [] } }]
    });
  });
});

describe('getActivityTypes', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(getActivityTypes('u1', 'g9', [])).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedTypeFind).not.toHaveBeenCalled();
  });

  it("scopes to the group's own types when access is allowed", async () => {
    mockedTypeFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await getActivityTypes('u1', 'g1', ['g1']);

    expect(mockedTypeFind).toHaveBeenCalledWith({
      isActive: true,
      groupId: 'g1'
    });
  });

  it('scopes to personal items when only userId is given', async () => {
    mockedTypeFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    await getActivityTypes('u1', undefined, []);

    expect(mockedTypeFind).toHaveBeenCalledWith({
      isActive: true,
      userId: 'u1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
  });
});

describe('getDescriptionsByTypeId', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(
      getDescriptionsByTypeId('507f1f77bcf86cd799439011', 'u1', [], 'g9')
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedDistinct).not.toHaveBeenCalled();
  });

  it('scopes to the group when access is allowed', async () => {
    mockedDistinct.mockResolvedValue(['Bar', 'apple']);

    const result = await getDescriptionsByTypeId('507f1f77bcf86cd799439011', 'u1', ['g1'], 'g1');

    const [, query] = mockedDistinct.mock.calls[0];
    expect(query.groupId).toBe('g1');
    // sorted case-insensitively and falsy entries filtered
    expect(result).toEqual(['apple', 'Bar']);
  });

  it('scopes to personal items when no groupId is given, filtering blanks', async () => {
    mockedDistinct.mockResolvedValue(['Zebra', '', 'ant']);

    const result = await getDescriptionsByTypeId('507f1f77bcf86cd799439011', 'u1', []);

    const [, query] = mockedDistinct.mock.calls[0];
    expect(query.userId).toBe('u1');
    expect(query.$or).toEqual([{ groupId: { $exists: false } }, { groupId: null }]);
    expect(result).toEqual(['ant', 'Zebra']);
  });
});
