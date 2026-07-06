jest.mock('../models/Activity', () => {
  const Activity: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: jest.fn().mockResolvedValue(undefined)
  }));
  Activity.find = jest.fn();
  Activity.findByIdAndUpdate = jest.fn();
  Activity.deleteMany = jest.fn();
  Activity.aggregate = jest.fn();
  return { Activity };
});

jest.mock('../models/ActivityType', () => ({
  ActivityType: { find: jest.fn() }
}));

import { Activity } from '../models/Activity';
import { ActivityType } from '../models/ActivityType';
import { dayToDate, saveDay, getDays } from './day.service';

const mockedActivityCtor = Activity as unknown as jest.Mock;
const mockedActivityFind = Activity.find as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Activity.findByIdAndUpdate as unknown as jest.Mock;
const mockedDeleteMany = Activity.deleteMany as unknown as jest.Mock;
const mockedAggregate = Activity.aggregate as unknown as jest.Mock;
const mockedTypeFind = ActivityType.find as unknown as jest.Mock;

// ActivityType.find(...).select('_id') resolves to the accessible type ids.
const mockAccessibleTypes = (ids: string[]) => {
  mockedTypeFind.mockReturnValue({ select: jest.fn().mockResolvedValue(ids.map((id) => ({ _id: id }))) });
};

// Activity.find(...).populate('typeId').sort(...) — the reload after a save.
const mockReload = (docs: unknown[]) => ({
  populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(docs) })
});

describe('dayToDate', () => {
  it('parses a YYYY-MM-DD key to UTC midnight', () => {
    expect(dayToDate('2024-05-01').toISOString()).toBe('2024-05-01T00:00:00.000Z');
  });

  it('rejects a wrongly formatted date', () => {
    expect(() => dayToDate('2024-5-1')).toThrow('Date must be formatted as YYYY-MM-DD');
    expect(() => dayToDate('05/01/2024')).toThrow('Date must be formatted as YYYY-MM-DD');
  });

  it('rejects an impossible date', () => {
    expect(() => dayToDate('2024-13-40')).toThrow('Invalid date');
  });
});

describe('saveDay', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(saveDay('2024-05-01', [], 'user-1', [], 'group-9')).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedActivityFind).not.toHaveBeenCalled();
  });

  it('rejects entries referencing an inaccessible activity type', async () => {
    mockAccessibleTypes(['t1']); // only t1 accessible, but t2 requested
    await expect(
      saveDay('2024-05-01', [{ typeId: 't1' }, { typeId: 't2' }], 'user-1', [])
    ).rejects.toMatchObject({ name: 'BadRequestError' });
    expect(mockedActivityCtor).not.toHaveBeenCalled();
  });

  it('reconciles a day: updates kept entries, creates new ones, deletes the rest', async () => {
    mockAccessibleTypes(['t1']);
    // existing entries on the day: e1 (kept) and e2 (should be deleted)
    mockedActivityFind
      .mockResolvedValueOnce([{ _id: 'e1' }, { _id: 'e2' }])
      .mockReturnValueOnce(mockReload([]));
    mockedDeleteMany.mockResolvedValue({});
    mockedFindByIdAndUpdate.mockResolvedValue({});

    await saveDay(
      '2024-05-01',
      [
        { _id: 'e1', typeId: 't1', hours: 2 }, // update
        { typeId: 't1', description: 'new entry' } // create
      ],
      'user-1',
      []
    );

    // e2 was not in the kept set → deleted
    expect(mockedDeleteMany).toHaveBeenCalledWith({ _id: { $in: ['e2'] } });
    // e1 updated
    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ $set: expect.objectContaining({ typeId: 't1', hours: 2 }) }),
      { runValidators: true }
    );
    // exactly one new Activity created
    expect(mockedActivityCtor).toHaveBeenCalledTimes(1);
    expect(mockedActivityCtor).toHaveBeenCalledWith(expect.objectContaining({ typeId: 't1', description: 'new entry', userId: 'user-1' }));
  });

  it('unsets description/hours when an updated entry omits them', async () => {
    mockAccessibleTypes(['t1']);
    mockedActivityFind
      .mockResolvedValueOnce([{ _id: 'e1' }])
      .mockReturnValueOnce(mockReload([]));
    mockedFindByIdAndUpdate.mockResolvedValue({});

    await saveDay('2024-05-01', [{ _id: 'e1', typeId: 't1' }], 'user-1', []);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ $unset: { description: '', hours: '' } }),
      { runValidators: true }
    );
  });

  it('clears the day when passed an empty entry list', async () => {
    mockedActivityFind
      .mockResolvedValueOnce([{ _id: 'e1' }, { _id: 'e2' }])
      .mockReturnValueOnce(mockReload([]));
    mockedDeleteMany.mockResolvedValue({});

    const result = await saveDay('2024-05-01', [], 'user-1', []);

    expect(mockedTypeFind).not.toHaveBeenCalled(); // no types to validate
    expect(mockedDeleteMany).toHaveBeenCalledWith({ _id: { $in: ['e1', 'e2'] } });
    expect(mockedActivityCtor).not.toHaveBeenCalled();
    expect(result).toEqual({ date: '2024-05-01', entries: [] });
  });
});

describe('getDays', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(
      getDays({ userId: 'user-1', userGroupIds: [], groupId: 'group-9' })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedAggregate).not.toHaveBeenCalled();
  });

  it('maps the aggregation facet into days + pagination', async () => {
    mockedAggregate.mockResolvedValue([
      {
        days: [{ _id: new Date('2024-05-02T00:00:00.000Z'), entries: [{ _id: 'a1' }] }],
        totalCount: [{ count: 5 }]
      }
    ]);

    const result = await getDays({ userId: 'user-1', userGroupIds: [], limit: 2 });

    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3); // ceil(5 / 2)
    expect(result.days).toEqual([{ date: '2024-05-02', entries: [{ _id: 'a1' }] }]);
  });
});
