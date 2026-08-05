import mongoose from 'mongoose';

jest.mock('../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn(),
    find: jest.fn()
  }
}));

import { Activity } from '../models/Activity';
import { getPlaces, getPlaceVisits } from './place.service';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;
const mockedFind = Activity.find as unknown as jest.Mock;

// Activity.find(...).populate(...).sort(...).limit(...) resolves to the visits.
const mockVisitQuery = (docs: unknown[]) => {
  const limit = jest.fn().mockResolvedValue(docs);
  const sort = jest.fn().mockReturnValue({ limit });
  const populate = jest.fn().mockReturnValue({ sort });
  mockedFind.mockReturnValue({ populate });
  return { populate, sort, limit };
};

const aggRow = (over: Record<string, unknown> = {}) => ({
  _id: { lat: 59.4405, lng: 24.7453 },
  label: 'Kolm Sõsarat',
  lat: 59.44051,
  lng: 24.74532,
  visits: 3,
  firstVisit: new Date('2024-01-02T00:00:00.000Z'),
  lastVisit: new Date('2024-06-11T00:00:00.000Z'),
  types: [
    { typeId: 't1', name: 'Restaurants', slug: 'restaurants', color: '#FF5733' },
    { typeId: 't1', name: 'Restaurants', slug: 'restaurants', color: '#FF5733' },
    { typeId: 't2', name: 'Date night', slug: 'date-night' }
  ],
  ...over
});

describe('getPlaces', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(
      getPlaces({ userId: 'user-1', userGroupIds: ['group-1'], groupId: 'group-9' })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedAggregate).not.toHaveBeenCalled();
  });

  it('maps aggregation rows into places with a per-type breakdown', async () => {
    mockedAggregate.mockResolvedValue([aggRow()]);

    const places = await getPlaces({ userId: 'user-1', userGroupIds: [] });

    expect(places).toEqual([
      {
        id: '59.4405,24.7453',
        label: 'Kolm Sõsarat',
        lat: 59.44051,
        lng: 24.74532,
        visits: 3,
        firstVisit: '2024-01-02',
        lastVisit: '2024-06-11',
        types: [
          { typeId: 't1', name: 'Restaurants', slug: 'restaurants', color: '#FF5733', count: 2 },
          { typeId: 't2', name: 'Date night', slug: 'date-night', color: undefined, count: 1 }
        ]
      }
    ]);
  });

  it('skips entries whose activity type no longer exists', async () => {
    mockedAggregate.mockResolvedValue([
      aggRow({ types: [{ typeId: undefined }, { typeId: 't1', name: 'Walks', slug: 'walks' }] })
    ]);

    const [place] = await getPlaces({ userId: 'user-1', userGroupIds: [] });

    expect(place.types).toEqual([{ typeId: 't1', name: 'Walks', slug: 'walks', color: undefined, count: 1 }]);
  });

  it('scopes to a group the user belongs to', async () => {
    mockedAggregate.mockResolvedValue([]);

    await getPlaces({ userId: 'user-1', userGroupIds: ['group-1'], groupId: 'group-1' });

    const match = mockedAggregate.mock.calls[0][0][0].$match;
    expect(match.groupId).toBe('group-1');
    expect(match.userId).toBeUndefined();
    expect(match.location).toEqual({ $exists: true, $ne: null });
  });

  it('scopes to the user\'s non-group entries by default', async () => {
    mockedAggregate.mockResolvedValue([]);

    await getPlaces({ userId: 'user-1', userGroupIds: [] });

    const match = mockedAggregate.mock.calls[0][0][0].$match;
    expect(match.userId).toBe('user-1');
    expect(match.$or).toEqual([{ groupId: { $exists: false } }, { groupId: null }]);
  });

  it('applies type and date-range filters to the match stage', async () => {
    mockedAggregate.mockResolvedValue([]);

    await getPlaces({
      userId: 'user-1',
      userGroupIds: [],
      typeId: '507f1f77bcf86cd799439011',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31')
    });

    const match = mockedAggregate.mock.calls[0][0][0].$match;
    expect(match.typeId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(match.date).toEqual({ $gte: new Date('2024-01-01'), $lte: new Date('2024-12-31') });
  });

  it('groups by rounded coordinates so near-identical pins fold together', async () => {
    mockedAggregate.mockResolvedValue([]);

    await getPlaces({ userId: 'user-1', userGroupIds: [] });

    const group = mockedAggregate.mock.calls[0][0].find((stage: Record<string, unknown>) => stage.$group);
    expect(group.$group._id).toEqual({
      lat: { $round: ['$location.lat', 4] },
      lng: { $round: ['$location.lng', 4] }
    });
  });
});

describe('getPlaceVisits', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(
      getPlaceVisits({ userId: 'user-1', userGroupIds: [], groupId: 'group-9', lat: 1, lng: 2 })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('matches a coordinate window matching the grouping precision', async () => {
    mockVisitQuery([]);

    await getPlaceVisits({ userId: 'user-1', userGroupIds: [], lat: 59.4405, lng: 24.7453 });

    const query = mockedFind.mock.calls[0][0];
    // half a rounding step (5e-5) either side of the pin
    expect(query['location.lat'].$gte).toBeCloseTo(59.44045, 8);
    expect(query['location.lat'].$lte).toBeCloseTo(59.44055, 8);
    expect(query['location.lng'].$gte).toBeCloseTo(24.74525, 8);
    expect(query['location.lng'].$lte).toBeCloseTo(24.74535, 8);
  });

  it('maps documents into visits with populated type details', async () => {
    mockVisitQuery([
      {
        date: new Date('2024-06-11T00:00:00.000Z'),
        typeId: { _id: 't1', name: 'Restaurants', color: '#FF5733' },
        description: 'tasting menu',
        hours: 3
      }
    ]);

    const visits = await getPlaceVisits({ userId: 'user-1', userGroupIds: [], lat: 1, lng: 2 });

    expect(visits).toEqual([
      {
        date: '2024-06-11',
        typeId: 't1',
        typeName: 'Restaurants',
        typeColor: '#FF5733',
        description: 'tasting menu',
        hours: 3
      }
    ]);
  });

  it('omits description and hours when the entry carries neither', async () => {
    mockVisitQuery([{ date: new Date('2024-06-11T00:00:00.000Z'), typeId: { _id: 't1', name: 'Walks' } }]);

    const [visit] = await getPlaceVisits({ userId: 'user-1', userGroupIds: [], lat: 1, lng: 2 });

    expect(visit).toEqual({ date: '2024-06-11', typeId: 't1', typeName: 'Walks', typeColor: undefined });
    expect('description' in visit).toBe(false);
    expect('hours' in visit).toBe(false);
  });

  it('falls back to the raw typeId when the type was not populated', async () => {
    mockVisitQuery([{ date: new Date('2024-06-11T00:00:00.000Z'), typeId: null }]);

    const [visit] = await getPlaceVisits({ userId: 'user-1', userGroupIds: [], lat: 1, lng: 2 });

    expect(visit.typeId).toBe('null');
    expect(visit.typeName).toBeUndefined();
  });

  it('honours a custom limit', async () => {
    const { limit } = mockVisitQuery([]);

    await getPlaceVisits({ userId: 'user-1', userGroupIds: [], lat: 1, lng: 2, limit: 5 });

    expect(limit).toHaveBeenCalledWith(5);
  });
});
