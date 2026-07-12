import { Request, Response } from 'express';

jest.mock('../services/dashboard.service', () => ({ getDashboardData: jest.fn() }));

import { getDashboardData } from '../services/dashboard.service';
import { getDashboard } from './dashboard.controller';

const mockedGetDashboardData = getDashboardData as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, userGroups: [], query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('getDashboard', () => {
  it('fetches the personal dashboard when no groupId is given', async () => {
    mockedGetDashboardData.mockResolvedValue({ overview: {} });
    const res = mockRes();

    await getDashboard(baseReq(), res);

    expect(mockedGetDashboardData).toHaveBeenCalledWith('user-1', undefined);
  });

  it('throws ForbiddenError for a group the user is not a member of', async () => {
    const res = mockRes();
    await expect(getDashboard(baseReq({ query: { groupId: 'g1' } }), res)).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('fetches the group dashboard when the user is a member', async () => {
    mockedGetDashboardData.mockResolvedValue({ overview: {} });
    const res = mockRes();

    await getDashboard(baseReq({ query: { groupId: 'g1' }, userGroups: ['g1'] }), res);

    expect(mockedGetDashboardData).toHaveBeenCalledWith('user-1', 'g1');
  });
});
