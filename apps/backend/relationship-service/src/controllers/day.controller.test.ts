import { Request, Response } from 'express';

jest.mock('../services/day.service', () => ({
  getDays: jest.fn(),
  saveDay: jest.fn()
}));

import * as DayService from '../services/day.service';
import { getDays, saveDay } from './day.controller';

const mockedGetDays = DayService.getDays as jest.Mock;
const mockedSaveDay = DayService.saveDay as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getDays', () => {
  it('parses query params and applies defaults', async () => {
    mockedGetDays.mockResolvedValue({ days: [], total: 0, page: 1, totalPages: 0 });
    const req = { user: { id: 'u1' }, userGroups: ['g1'], query: {} } as unknown as Request;

    await getDays(req, mockRes());

    expect(mockedGetDays).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: ['g1'],
      groupId: undefined,
      page: 1,
      limit: 30,
      typeId: undefined,
      search: undefined,
      startDate: undefined,
      endDate: undefined
    });
  });

  it('parses provided query params', async () => {
    mockedGetDays.mockResolvedValue({ days: [], total: 0, page: 2, totalPages: 1 });
    const req = {
      user: { id: 'u1' },
      userGroups: [],
      query: {
        groupId: 'g1',
        page: '2',
        limit: '10',
        typeId: 't1',
        search: 'coffee',
        startDate: '2024-01-01',
        endDate: '2024-02-01'
      }
    } as unknown as Request;

    await getDays(req, mockRes());

    expect(mockedGetDays).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: [],
      groupId: 'g1',
      page: 2,
      limit: 10,
      typeId: 't1',
      search: 'coffee',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01')
    });
  });
});

describe('saveDay', () => {
  it('delegates to the service with the parsed date param', async () => {
    mockedSaveDay.mockResolvedValue({ date: '2024-05-01', entries: [] });
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      params: { date: '2024-05-01' },
      body: { entries: [{ typeId: 't1' }], groupId: 'g1' }
    } as unknown as Request;
    const res = mockRes();

    await saveDay(req, res);

    expect(mockedSaveDay).toHaveBeenCalledWith('2024-05-01', [{ typeId: 't1' }], 'u1', ['g1'], 'g1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { date: '2024-05-01', entries: [] }, message: 'Day saved successfully' })
    );
  });
});
