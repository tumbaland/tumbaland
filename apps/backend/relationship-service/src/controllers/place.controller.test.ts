import { Request, Response } from 'express';

jest.mock('../services/place.service', () => ({
  getPlaces: jest.fn(),
  getPlaceVisits: jest.fn()
}));

import * as PlaceService from '../services/place.service';
import { getPlaces, getPlaceVisits } from './place.controller';

const mockedGetPlaces = PlaceService.getPlaces as jest.Mock;
const mockedGetPlaceVisits = PlaceService.getPlaceVisits as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getPlaces', () => {
  it('passes the caller scope through with no filters', async () => {
    mockedGetPlaces.mockResolvedValue([]);
    const req = { user: { id: 'u1' }, userGroups: ['g1'], query: {} } as unknown as Request;

    await getPlaces(req, mockRes());

    expect(mockedGetPlaces).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: ['g1'],
      groupId: undefined,
      typeId: undefined,
      startDate: undefined,
      endDate: undefined
    });
  });

  it('parses group, type and date-range filters', async () => {
    mockedGetPlaces.mockResolvedValue([]);
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      query: { groupId: 'g1', typeId: 't1', startDate: '2024-01-01', endDate: '2024-12-31' }
    } as unknown as Request;

    await getPlaces(req, mockRes());

    expect(mockedGetPlaces).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: ['g1'],
      groupId: 'g1',
      typeId: 't1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31')
    });
  });

  it('defaults userGroups to an empty list', async () => {
    mockedGetPlaces.mockResolvedValue([]);
    const req = { user: { id: 'u1' }, query: {} } as unknown as Request;

    await getPlaces(req, mockRes());

    expect(mockedGetPlaces).toHaveBeenCalledWith(expect.objectContaining({ userGroupIds: [] }));
  });

  it('sends the places back to the caller', async () => {
    const places = [{ id: '1,2', label: 'Home', lat: 1, lng: 2, visits: 4 }];
    mockedGetPlaces.mockResolvedValue(places);
    const res = mockRes();

    await getPlaces({ user: { id: 'u1' }, query: {} } as unknown as Request, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: places }));
  });
});

describe('getPlaceVisits', () => {
  it('parses coordinates and applies the default limit', async () => {
    mockedGetPlaceVisits.mockResolvedValue([]);
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      query: { lat: '59.4405', lng: '24.7453' }
    } as unknown as Request;

    await getPlaceVisits(req, mockRes());

    expect(mockedGetPlaceVisits).toHaveBeenCalledWith({
      userId: 'u1',
      userGroupIds: ['g1'],
      groupId: undefined,
      lat: 59.4405,
      lng: 24.7453,
      limit: 50
    });
  });

  it('parses an explicit limit and group', async () => {
    mockedGetPlaceVisits.mockResolvedValue([]);
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      query: { lat: '0', lng: '0', limit: '10', groupId: 'g1' }
    } as unknown as Request;

    await getPlaceVisits(req, mockRes());

    expect(mockedGetPlaceVisits).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 0, lng: 0, limit: 10, groupId: 'g1' })
    );
  });

  it.each([
    ['missing', {}],
    ['non-numeric', { lat: 'north', lng: 'east' }],
    ['partial', { lat: '59.4' }]
  ])('rejects %s coordinates', async (_case, query) => {
    const req = { user: { id: 'u1' }, query } as unknown as Request;

    await expect(getPlaceVisits(req, mockRes())).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(mockedGetPlaceVisits).not.toHaveBeenCalled();
  });

  it('sends the visits back to the caller', async () => {
    const visits = [{ date: '2024-06-11', typeId: 't1' }];
    mockedGetPlaceVisits.mockResolvedValue(visits);
    const res = mockRes();

    await getPlaceVisits({ user: { id: 'u1' }, query: { lat: '1', lng: '2' } } as unknown as Request, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: visits }));
  });
});
