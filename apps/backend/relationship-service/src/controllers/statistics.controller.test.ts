import { Request, Response } from 'express';

jest.mock('../services/statistics', () => ({
  getRelationshipStatistics: jest.fn(),
  getMonthlyHours: jest.fn(),
  getMonthlyStatistics: jest.fn(),
  getMonthlyActivityBreakdown: jest.fn(),
  getWeeklyHeatmapData: jest.fn(),
  getCumulativeTimelineData: jest.fn(),
  getStreakStatistics: jest.fn(),
  getMilestones: jest.fn(),
  getTrends: jest.fn()
}));

jest.mock('../services/dashboardSettings.service', () => ({
  getDashboardSettings: jest.fn()
}));

import * as StatisticsService from '../services/statistics';
import { getDashboardSettings } from '../services/dashboardSettings.service';
import {
  getStatistics,
  getMonthlyHoursData,
  getMonthlyStatisticsData,
  getMonthlyActivityBreakdownData,
  getWeeklyHeatmapDataController,
  getCumulativeTimelineDataController,
  getStreaks,
  getMilestonesData,
  getTrendsData
} from './statistics.controller';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getStatistics', () => {
  it('rejects an invalid timeframe', async () => {
    const req = { query: { timeframe: 'decade' }, user: { id: 'u1' } } as unknown as Request;
    await expect(getStatistics(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('defaults timeframe to "all" and scopes to the group when given', async () => {
    (StatisticsService.getRelationshipStatistics as jest.Mock).mockResolvedValue({ totalHours: 5 });
    const req = { query: { groupId: 'g1' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;
    const res = mockRes();

    await getStatistics(req, res);

    expect(StatisticsService.getRelationshipStatistics).toHaveBeenCalledWith('all', { userId: 'u1', groupId: 'g1' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { totalHours: 5 }, timeframe: 'all' })
    );
  });

  it('scopes to personal-only stats when no group is given', async () => {
    (StatisticsService.getRelationshipStatistics as jest.Mock).mockResolvedValue({});
    const req = { query: { timeframe: 'week' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;

    await getStatistics(req, mockRes());

    expect(StatisticsService.getRelationshipStatistics).toHaveBeenCalledWith('week', {
      userId: 'u1',
      userGroupIds: ['g1'],
      personalOnly: true
    });
  });
});

describe('getStreaks', () => {
  it('scopes personally when no group is given', async () => {
    (StatisticsService.getStreakStatistics as jest.Mock).mockResolvedValue({ currentStreak: 3 });
    const req = { query: {}, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;
    const res = mockRes();

    await getStreaks(req, res);

    expect(StatisticsService.getStreakStatistics).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: ['g1'],
      personalOnly: true
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { currentStreak: 3 } })
    );
  });

  it('scopes to the group when given', async () => {
    (StatisticsService.getStreakStatistics as jest.Mock).mockResolvedValue({});
    const req = { query: { groupId: 'g1' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;

    await getStreaks(req, mockRes());

    expect(StatisticsService.getStreakStatistics).toHaveBeenCalledWith({ userId: 'u1', groupId: 'g1' });
  });
});

describe('a group the caller is not in', () => {
  it.each([
    { name: 'getStatistics', handler: getStatistics, read: StatisticsService.getRelationshipStatistics },
    { name: 'getStreaks', handler: getStreaks, read: StatisticsService.getStreakStatistics },
    { name: 'getMonthlyHoursData', handler: getMonthlyHoursData, read: StatisticsService.getMonthlyHours },
    { name: 'getMonthlyStatisticsData', handler: getMonthlyStatisticsData, read: StatisticsService.getMonthlyStatistics },
    {
      name: 'getMonthlyActivityBreakdownData',
      handler: getMonthlyActivityBreakdownData,
      read: StatisticsService.getMonthlyActivityBreakdown
    },
    {
      name: 'getWeeklyHeatmapDataController',
      handler: getWeeklyHeatmapDataController,
      read: StatisticsService.getWeeklyHeatmapData
    },
    {
      name: 'getCumulativeTimelineDataController',
      handler: getCumulativeTimelineDataController,
      read: StatisticsService.getCumulativeTimelineData
    }
  ])('$name refuses, reading nothing', async ({ handler, read }) => {
    const req = { query: { groupId: 'g-other' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;

    await expect(handler(req, mockRes())).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('year-param controllers', () => {
  it('getMonthlyHoursData rejects an invalid year', async () => {
    const req = { query: { year: '1999' }, user: { id: 'u1' } } as unknown as Request;
    await expect(getMonthlyHoursData(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
  });

  it('getMonthlyHoursData passes undefined when no year given, scoped personally', async () => {
    (StatisticsService.getMonthlyHours as jest.Mock).mockResolvedValue([]);
    const req = { query: {}, user: { id: 'u1' }, userGroups: [] } as unknown as Request;

    await getMonthlyHoursData(req, mockRes());

    expect(StatisticsService.getMonthlyHours).toHaveBeenCalledWith(undefined, {
      userId: 'u1',
      userGroupIds: [],
      personalOnly: true
    });
  });

  it('getMonthlyStatisticsData scopes to the group when given', async () => {
    (StatisticsService.getMonthlyStatistics as jest.Mock).mockResolvedValue([]);
    const req = { query: { year: '2024', groupId: 'g1' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;
    const res = mockRes();

    await getMonthlyStatisticsData(req, res);

    expect(StatisticsService.getMonthlyStatistics).toHaveBeenCalledWith(2024, { userId: 'u1', groupId: 'g1' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [] }));
  });

  it('getMonthlyActivityBreakdownData delegates with parsed year', async () => {
    (StatisticsService.getMonthlyActivityBreakdown as jest.Mock).mockResolvedValue({});
    const req = { query: { year: '2024' }, user: { id: 'u1' }, userGroups: [] } as unknown as Request;

    await getMonthlyActivityBreakdownData(req, mockRes());

    expect(StatisticsService.getMonthlyActivityBreakdown).toHaveBeenCalledWith(2024, {
      userId: 'u1',
      userGroupIds: [],
      personalOnly: true
    });
  });

  it('getWeeklyHeatmapDataController delegates with parsed year', async () => {
    (StatisticsService.getWeeklyHeatmapData as jest.Mock).mockResolvedValue([]);
    const req = { query: { year: '2024' }, user: { id: 'u1' }, userGroups: [] } as unknown as Request;

    await getWeeklyHeatmapDataController(req, mockRes());

    expect(StatisticsService.getWeeklyHeatmapData).toHaveBeenCalledWith(2024, {
      userId: 'u1',
      userGroupIds: [],
      personalOnly: true
    });
  });

  it('getCumulativeTimelineDataController delegates with parsed year', async () => {
    (StatisticsService.getCumulativeTimelineData as jest.Mock).mockResolvedValue([]);
    const req = { query: { year: '2024' }, user: { id: 'u1' }, userGroups: [] } as unknown as Request;

    await getCumulativeTimelineDataController(req, mockRes());

    expect(StatisticsService.getCumulativeTimelineData).toHaveBeenCalledWith(2024, {
      userId: 'u1',
      userGroupIds: [],
      personalOnly: true
    });
  });

  it('rejects a year beyond next year', async () => {
    const nextYearPlusOne = new Date().getFullYear() + 2;
    const req = { query: { year: String(nextYearPlusOne) }, user: { id: 'u1' } } as unknown as Request;
    await expect(getMonthlyStatisticsData(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});

describe('getMilestonesData', () => {
  const settings = { highlightTypeIds: [], hiddenTypeIds: ['t9'], startDate: '2024-10-27' };

  beforeEach(() => {
    (getDashboardSettings as jest.Mock).mockResolvedValue(settings);
    (StatisticsService.getMilestones as jest.Mock).mockResolvedValue({ recent: [], upcoming: [] });
  });

  it('passes the scope dashboard settings through so both views agree', async () => {
    const req = { query: { groupId: 'g1' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;
    const res = mockRes();

    await getMilestonesData(req, res);

    expect(getDashboardSettings).toHaveBeenCalledWith('u1', ['g1'], 'g1');
    expect(StatisticsService.getMilestones).toHaveBeenCalledWith(
      { userId: 'u1', groupId: 'g1' },
      { startDate: '2024-10-27', hiddenTypeIds: ['t9'] }
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { recent: [], upcoming: [] } })
    );
  });

  it('reads personal settings and personal entries when no group is given', async () => {
    const req = { query: {}, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;

    await getMilestonesData(req, mockRes());

    expect(getDashboardSettings).toHaveBeenCalledWith('u1', ['g1'], undefined);
    expect(StatisticsService.getMilestones).toHaveBeenCalledWith(
      { userId: 'u1', userGroupIds: ['g1'], personalOnly: true },
      expect.anything()
    );
  });
});

describe('getTrendsData', () => {
  const settings = { highlightTypeIds: [], hiddenTypeIds: ['t9'], startDate: null };

  beforeEach(() => {
    (getDashboardSettings as jest.Mock).mockResolvedValue(settings);
    (StatisticsService.getTrends as jest.Mock).mockResolvedValue({ types: [] });
  });

  it('defaults to a 30-day window and hides the same types the dashboard hides', async () => {
    const req = { query: { groupId: 'g1' }, user: { id: 'u1' }, userGroups: ['g1'] } as unknown as Request;
    const res = mockRes();

    await getTrendsData(req, res);

    expect(getDashboardSettings).toHaveBeenCalledWith('u1', ['g1'], 'g1');
    expect(StatisticsService.getTrends).toHaveBeenCalledWith(
      { userId: 'u1', groupId: 'g1' },
      { windowDays: 30, hiddenTypeIds: ['t9'] }
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { types: [] } })
    );
  });

  it('passes a requested window through', async () => {
    const req = { query: { window: '7' }, user: { id: 'u1' }, userGroups: [] } as unknown as Request;

    await getTrendsData(req, mockRes());

    expect(StatisticsService.getTrends).toHaveBeenCalledWith(
      { userId: 'u1', userGroupIds: [], personalOnly: true },
      { windowDays: 7, hiddenTypeIds: ['t9'] }
    );
  });

  it.each(['3', '365', 'week'])('rejects an out-of-range or unparseable window=%s', async (window) => {
    const req = { query: { window }, user: { id: 'u1' }, userGroups: [] } as unknown as Request;
    await expect(getTrendsData(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
  });
});
