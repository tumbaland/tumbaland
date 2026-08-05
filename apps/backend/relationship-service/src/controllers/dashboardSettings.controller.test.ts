import { Request, Response } from 'express';

jest.mock('../services/dashboardSettings.service', () => ({
  getDashboardSettings: jest.fn(),
  saveDashboardSettings: jest.fn()
}));

import * as DashboardSettingsService from '../services/dashboardSettings.service';
import { getDashboardSettings, saveDashboardSettings } from './dashboardSettings.controller';

const mockedGet = DashboardSettingsService.getDashboardSettings as jest.Mock;
const mockedSave = DashboardSettingsService.saveDashboardSettings as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getDashboardSettings', () => {
  it('fetches settings scoped to the current user/group', async () => {
    mockedGet.mockResolvedValue({ highlightTypeIds: ['t1'], hiddenTypeIds: [] });
    const req = { user: { id: 'u1' }, userGroups: ['g1'], query: { groupId: 'g1' } } as unknown as Request;
    const res = mockRes();

    await getDashboardSettings(req, res);

    expect(mockedGet).toHaveBeenCalledWith('u1', ['g1'], 'g1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { highlightTypeIds: ['t1'], hiddenTypeIds: [] } })
    );
  });

  it('defaults userGroups to an empty array when missing', async () => {
    mockedGet.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [] });
    const req = { user: { id: 'u1' }, query: {} } as unknown as Request;

    await getDashboardSettings(req, mockRes());

    expect(mockedGet).toHaveBeenCalledWith('u1', [], undefined);
  });
});

describe('saveDashboardSettings', () => {
  it('saves settings scoped to the current user/group', async () => {
    mockedSave.mockResolvedValue({ highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'] });
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      body: { highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'], startDate: '2024-01-18', groupId: 'g1' }
    } as unknown as Request;
    const res = mockRes();

    await saveDashboardSettings(req, res);

    expect(mockedSave).toHaveBeenCalledWith(
      { highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'], startDate: '2024-01-18' },
      'u1',
      ['g1'],
      'g1'
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'] }, message: 'Dashboard settings saved' })
    );
  });
});
