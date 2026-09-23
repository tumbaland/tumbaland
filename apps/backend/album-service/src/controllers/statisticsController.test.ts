import { Request, Response } from 'express';

jest.mock('../services/statisticsService', () => ({
  __esModule: true,
  default: { getAlbumStatistics: jest.fn() }
}));

import statisticsService from '../services/statisticsService';
import { getAlbumStatistics } from './statisticsController';

const mocked = statisticsService as jest.Mocked<typeof statisticsService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getAlbumStatistics', () => {
  it('passes the groupId filter and user context through to the service', async () => {
    mocked.getAlbumStatistics.mockResolvedValue({ overview: { totalAlbums: 1 } } as never);
    const res = mockRes();
    const req = {
      user: { id: 'user-1' },
      userGroups: ['g1'],
      query: { groupId: 'g1' }
    } as unknown as Request;

    await getAlbumStatistics(req, res);

    expect(mocked.getAlbumStatistics).toHaveBeenCalledWith({ groupId: 'g1' }, { userId: 'user-1', userGroups: ['g1'] });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
