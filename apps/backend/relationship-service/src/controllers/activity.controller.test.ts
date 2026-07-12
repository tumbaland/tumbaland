import { Request, Response } from 'express';

jest.mock('../services/activity.service', () => ({
  createActivity: jest.fn(),
  getActivities: jest.fn(),
  getActivityById: jest.fn(),
  updateActivity: jest.fn(),
  deleteActivity: jest.fn(),
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
  getActivityStats,
  getActivitiesByDateRange,
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
    mockedTypeFindOne.mockResolvedValue(null);
    const req = { user: { id: 'u1' }, userGroups: [], body: { typeId: 't1' } } as unknown as Request;

    await expect(createActivity(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(ActivityService.createActivity).not.toHaveBeenCalled();
  });

  it('creates the activity when the type is accessible', async () => {
    mockedTypeFindOne.mockResolvedValue({ _id: 't1' });
    (ActivityService.createActivity as jest.Mock).mockResolvedValue({ _id: 'a1' });
    const req = { user: { id: 'u1' }, userGroups: ['g1'], body: { typeId: 't1', hours: 2 } } as unknown as Request;
    const res = mockRes();

    await createActivity(req, res);

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
    (ActivityService.getActivities as jest.Mock).mockResolvedValue({ activities: [], total: 0, page: 1, totalPages: 0 });
    const req = { user: { id: 'u1' }, query: {} } as unknown as Request;

    await getActivities(req, mockRes());

    expect(ActivityService.getActivities).toHaveBeenCalledWith({ userId: 'u1', userGroupIds: [] });
  });
});

describe('getActivityById', () => {
  it('throws NotFoundError when missing', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 'a1' } } as unknown as Request;
    await expect(getActivityById(req, mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the activity when found', async () => {
    (ActivityService.getActivityById as jest.Mock).mockResolvedValue({ _id: 'a1' });
    const req = { params: { id: 'a1' } } as unknown as Request;
    const res = mockRes();

    await getActivityById(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 'a1' } }));
  });
});

describe('updateActivity', () => {
  it('throws NotFoundError when missing', async () => {
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 'a1' }, body: {} } as unknown as Request;
    await expect(updateActivity(req, mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the updated activity', async () => {
    (ActivityService.updateActivity as jest.Mock).mockResolvedValue({ _id: 'a1', hours: 3 });
    const req = { params: { id: 'a1' }, body: { hours: 3 } } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 'a1', hours: 3 } }));
  });
});

describe('deleteActivity', () => {
  it('throws NotFoundError when nothing was deleted', async () => {
    (ActivityService.deleteActivity as jest.Mock).mockResolvedValue(false);
    const req = { params: { id: 'a1' } } as unknown as Request;
    await expect(deleteActivity(req, mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('confirms deletion', async () => {
    (ActivityService.deleteActivity as jest.Mock).mockResolvedValue(true);
    const req = { params: { id: 'a1' } } as unknown as Request;
    const res = mockRes();

    await deleteActivity(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Activity deleted successfully' }));
  });
});

describe('getActivityStats', () => {
  it('parses optional date filters', async () => {
    (ActivityService.getActivityStats as jest.Mock).mockResolvedValue({ byType: [], overall: {} });
    const req = { query: { startDate: '2024-01-01', endDate: '2024-02-01' } } as unknown as Request;

    await getActivityStats(req, mockRes());

    expect(ActivityService.getActivityStats).toHaveBeenCalledWith({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01')
    });
  });

  it('defaults to an empty filter set', async () => {
    (ActivityService.getActivityStats as jest.Mock).mockResolvedValue({});
    const req = { query: {} } as unknown as Request;

    await getActivityStats(req, mockRes());

    expect(ActivityService.getActivityStats).toHaveBeenCalledWith({});
  });
});

describe('getActivitiesByDateRange', () => {
  it('rejects when startDate or endDate is missing', async () => {
    const req = { query: { startDate: '2024-01-01' } } as unknown as Request;
    await expect(getActivitiesByDateRange(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('returns activities in the given range', async () => {
    (ActivityService.getActivitiesByDateRange as jest.Mock).mockResolvedValue([{ _id: 'a1' }]);
    const req = { query: { startDate: '2024-01-01', endDate: '2024-02-01' } } as unknown as Request;
    const res = mockRes();

    await getActivitiesByDateRange(req, res);

    expect(ActivityService.getActivitiesByDateRange).toHaveBeenCalledWith(new Date('2024-01-01'), new Date('2024-02-01'));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ _id: 'a1' }] }));
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
