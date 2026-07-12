import { Request, Response } from 'express';

jest.mock('../services/statistics.service', () => ({
  getRelationshipStatistics: jest.fn(),
  getMonthlyHours: jest.fn(),
  getMonthlyStatistics: jest.fn(),
  getMonthlyActivityBreakdown: jest.fn(),
  getWeeklyHeatmapData: jest.fn(),
  getCumulativeTimelineData: jest.fn()
}));

import * as StatisticsService from '../services/statistics.service';
import {
  getStatistics,
  getMonthlyHoursData,
  getMonthlyStatisticsData,
  getMonthlyActivityBreakdownData,
  getWeeklyHeatmapDataController,
  getCumulativeTimelineDataController
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
