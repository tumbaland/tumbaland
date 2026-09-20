import { Request, Response } from 'express';

jest.mock('../services/activity.service', () => ({
  createActivity: jest.fn(),
  getActivities: jest.fn(),
  getActivityById: jest.fn(),
  updateActivity: jest.fn(),
  deleteActivity: jest.fn(),
  isTypeAccessible: jest.fn(),
  getActivityStats: jest.fn(),
  getActivitiesByDateRange: jest.fn(),
  getActivityTypes: jest.fn(),
  getDescriptionsByTypeId: jest.fn()
}));

const mockedTypeFindOne = jest.fn();
jest.mock('../models/ActivityType', () => ({
  ActivityType: { findOne: (...args: unknown[]) => mockedTypeFindOne(...args) }
}));

import * as ActivityService from '../services/activity.service';
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getRecentActivities,
  getActivityTypes,
  getRecentActivitiesSummary,
  getActivityDescriptions
} from './activity.controller';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('createActivity', () => {
  it('rejects an inaccessible or missing activity type', async () => {
    (ActivityService.isTypeAccessible as jest.Mock).mockResolvedValue(false);
    const req = { user: { id: 'u1' }, userGroups: [], body: { typeId: 't1' } } as unknown as Request;

    await expect(createActivity(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(ActivityService.createActivity).not.toHaveBeenCalled();
  });

  it('creates the activity when the type is accessible', async () => {
    (ActivityService.isTypeAccessible as jest.Mock).mockResolvedValue(true);
    (ActivityService.createActivity as jest.Mock).mockResolvedValue({ _id: 'a1' });
    const req = { user: { id: 'u1' }, userGroups: ['g1'], body: { typeId: 't1', hours: 2 } } as unknown as Request;
    const res = mockRes();

    await createActivity(req, res);

    expect(ActivityService.isTypeAccessible).toHaveBeenCalledWith('t1', 'u1', ['g1'], undefined);
    expect(ActivityService.createActivity).toHaveBeenCalledWith({ typeId: 't1', hours: 2, userId: 'u1' });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('getActivities', () => {
  it('parses filters from query params and shapes the pagination response', async () => {
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({
      activities: [{ _id: 'a1' }],
      total: 1,
      page: 1,
      totalPages: 1
    });
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      query: {
        activityType: 'reading',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        description: 'book',
        limit: '10',
        page: '1',
        sortBy: 'hours',
        sortOrder: 'desc',
        groupId: 'g1'
      }
    } as unknown as Request;
    const res = mockRes();

    await getActivities(req, res);

    expect(ActivityService.getActivities).toHaveBeenCalledWith({
      activityType: 'reading',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
      description: 'book',
      limit: 10,
      page: 1,
      sortBy: 'hours',
      sortOrder: 'desc',
      groupId: 'g1',
      userId: 'u1',
      userGroupIds: ['g1']
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { activities: [{ _id: 'a1' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }
      })
    );
  });

  it('applies defaults when no query params are given', async () => {
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({
      activities: [],
      total: 0,
      page: 1,
      totalPages: 0
    });
    const req = { user: { id: 'u1' }, query: {} } as unknown as Request;

    await getActivities(req, mockRes());

    expect(ActivityService.getActivities).toHaveBeenCalledWith({ userId: 'u1', userGroupIds: [] });
  });
});

/**
 * Every by-id route carries the caller's scope down to the query.
 *
 * These tests used to build a `req` with no user on it at all and still pass,
 * because the handlers passed nothing but the id — which is precisely the hole
 * that let one account reach another's entry. Asserting the scope argument is
 * what makes a regression here visible.
 */
const byId = (over: Partial<Request> = {}) =>
  ({ user: { id: 'u1' }, userGroups: ['g1'], params: { id: 'a1' }, body: {}, ...over }) as unknown as Request;

describe('getActivityById', () => {
  it('throws NotFoundError when missing', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue(null);
    await expect(getActivityById(byId(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('reads only within the caller’s scope', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue({ _id: 'a1' });
    const res = mockRes();

    await getActivityById(byId(), res);

    expect(ActivityService.getActivityById).toHaveBeenCalledWith('a1', 'u1', ['g1']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 'a1' } }));
  });
});

describe('updateActivity', () => {
  it('throws NotFoundError when missing', async () => {
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue(null);
    await expect(updateActivity(byId(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('writes only within the caller’s scope', async () => {
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue({ _id: 'a1', hours: 3 });
    const res = mockRes();

    await updateActivity(byId({ body: { hours: 3 } } as Partial<Request>), res);

    expect(ActivityService.updateActivity).toHaveBeenCalledWith('a1', { hours: 3 }, 'u1', ['g1']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 'a1', hours: 3 } }));
  });

  it('refuses to move an entry onto a type the caller cannot reach', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue({ _id: 'a1' });
    (ActivityService.isTypeAccessible as jest.Mock).mockResolvedValue(false);

    await expect(
      updateActivity(byId({ body: { typeId: 'someone-elses' } } as Partial<Request>), mockRes())
    ).rejects.toMatchObject({ name: 'BadRequestError' });

    // Otherwise the check on the create path is only as strong as the absence
    // of an edit endpoint.
    expect(ActivityService.updateActivity).not.toHaveBeenCalled();
  });

  it('allows a type change the caller can reach', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue({ _id: 'a1' });
    (ActivityService.isTypeAccessible as jest.Mock).mockResolvedValue(true);
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue({ _id: 'a1', typeId: 't2' });

    await updateActivity(byId({ body: { typeId: 't2' } } as Partial<Request>), mockRes());

    expect(ActivityService.isTypeAccessible).toHaveBeenCalledWith('t2', 'u1', ['g1'], undefined);
    expect(ActivityService.updateActivity).toHaveBeenCalledWith('a1', { typeId: 't2' }, 'u1', ['g1']);
  });

  it("checks the new type against the entry's own scope, not everything the caller can reach", async () => {
    // The entry lives in g1, so the type has to be one of g1's. Passing only
    // "anything this caller can touch" is how a personal type ended up on a
    // group entry in the first place.
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue({ _id: 'a1', groupId: 'g1' });
    (ActivityService.isTypeAccessible as jest.Mock).mockResolvedValue(true);
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue({ _id: 'a1', typeId: 't2' });

    await updateActivity(byId({ body: { typeId: 't2' } } as Partial<Request>), mockRes());

    expect(ActivityService.isTypeAccessible).toHaveBeenCalledWith('t2', 'u1', ['g1'], 'g1');
  });

  it('refuses a type change on an entry the caller cannot see', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue(null);

    await expect(updateActivity(byId({ body: { typeId: 't2' } } as Partial<Request>), mockRes())).rejects.toMatchObject(
      { name: 'NotFoundError' }
    );

    expect(ActivityService.updateActivity).not.toHaveBeenCalled();
  });

  it('does not look up a type when the edit leaves it alone', async () => {
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue({ _id: 'a1' });

    await updateActivity(byId({ body: { description: 'later' } } as Partial<Request>), mockRes());

    expect(ActivityService.isTypeAccessible).not.toHaveBeenCalled();
  });
});

describe('deleteActivity', () => {
  it('throws NotFoundError when nothing was deleted', async () => {
    (ActivityService.deleteActivity as jest.Mock).mockResolvedValue(false);
    await expect(deleteActivity(byId(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('deletes only within the caller’s scope', async () => {
    (ActivityService.deleteActivity as jest.Mock).mockResolvedValue(true);
    const res = mockRes();

    await deleteActivity(byId(), res);

    expect(ActivityService.deleteActivity).toHaveBeenCalledWith('a1', 'u1', ['g1']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Activity deleted successfully' }));
  });
});

describe('getRecentActivities', () => {
  it('defaults the limit to 10', async () => {
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({ activities: [] });
    const req = { user: { id: 'u1' }, userGroups: [], query: {} } as unknown as Request;

    await getRecentActivities(req, mockRes());

    expect(ActivityService.getActivities).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc', userId: 'u1', userGroupIds: [] })
    );
  });

  it('passes the group through, so a shared journal is not answered as an empty one', async () => {
    // Without a groupId, getActivities falls through to its personal branch:
    // the caller's own entries, and only those carrying no groupId.
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({ activities: [] });
    const req = { user: { id: 'u1' }, userGroups: ['g1'], query: { groupId: 'g1' } } as unknown as Request;

    await getRecentActivities(req, mockRes());

    expect(ActivityService.getActivities).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
  });

  it('leaves the group undefined in a personal context', async () => {
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({ activities: [] });
    const req = { user: { id: 'u1' }, userGroups: ['g1'], query: {} } as unknown as Request;

    await getRecentActivities(req, mockRes());

    expect(ActivityService.getActivities).toHaveBeenCalledWith(expect.objectContaining({ groupId: undefined }));
  });

  it('parses a provided limit', async () => {
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({ activities: [{ _id: 'a1' }] });
    const req = { user: { id: 'u1' }, userGroups: [], query: { limit: '3' } } as unknown as Request;
    const res = mockRes();

    await getRecentActivities(req, res);

    expect(ActivityService.getActivities).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ _id: 'a1' }] }));
  });
});

describe('getActivityTypes', () => {
  it('delegates to the service with the user/group context', async () => {
    (ActivityService.getActivityTypes as jest.Mock).mockResolvedValue([{ slug: 'reading' }]);
    const req = { user: { id: 'u1' }, userGroups: ['g1'], query: { groupId: 'g1' } } as unknown as Request;
    const res = mockRes();

    await getActivityTypes(req, res);

    expect(ActivityService.getActivityTypes).toHaveBeenCalledWith('u1', 'g1', ['g1']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ slug: 'reading' }] }));
  });
});

describe('getRecentActivitiesSummary', () => {
  it('builds a per-category, per-timeline summary', async () => {
    (ActivityService.getActivityTypes as jest.Mock).mockResolvedValue([{ slug: 'reading' }]);
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({ activities: [{ _id: 'a1' }] });
    const req = { user: { id: 'u1' }, userGroups: [], query: { groupId: 'g1' } } as unknown as Request;
    const res = mockRes();

    await getRecentActivitiesSummary(req, res);

    // 3 timelines (1/3/12 months) fetched for the single 'reading' category
    expect(ActivityService.getActivities).toHaveBeenCalledTimes(3);
    expect(ActivityService.getActivities).toHaveBeenCalledWith(
      expect.objectContaining({ activityType: 'reading', groupId: 'g1', userId: 'u1' })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reading: {
            '1months': { label: 'Last Month', activities: [{ _id: 'a1' }] },
            '3months': { label: 'Last 3 Months', activities: [{ _id: 'a1' }] },
            '12months': { label: 'Last Year', activities: [{ _id: 'a1' }] }
          }
        }
      })
    );
  });

  it('omits groupId from filters when not provided', async () => {
    (ActivityService.getActivityTypes as jest.Mock).mockResolvedValue([]);
    const req = { user: { id: 'u1' }, userGroups: [], query: {} } as unknown as Request;

    await getRecentActivitiesSummary(req, mockRes());

    expect(ActivityService.getActivities).not.toHaveBeenCalled();
  });
});

describe('getActivityDescriptions', () => {
  it('rejects when typeId is missing', async () => {
    const req = { query: {}, user: { id: 'u1' }, userGroups: [] } as unknown as Request;
    await expect(getActivityDescriptions(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('returns descriptions for the given type', async () => {
    (ActivityService.getDescriptionsByTypeId as jest.Mock).mockResolvedValue(['a', 'b']);
    const req = {
      query: { typeId: 't1', groupId: 'g1' },
      user: { id: 'u1' },
      userGroups: ['g1']
    } as unknown as Request;
    const res = mockRes();

    await getActivityDescriptions(req, res);

    expect(ActivityService.getDescriptionsByTypeId).toHaveBeenCalledWith('t1', 'u1', ['g1'], 'g1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: ['a', 'b'] }));
  });
});
