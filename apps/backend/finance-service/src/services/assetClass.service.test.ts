const mockSave = jest.fn();

jest.mock('../models/AssetClass', () => {
  const ctor = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    save: (...args: unknown[]) => mockSave(...args)
  }));
  return {
    __esModule: true,
    default: Object.assign(ctor, {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn()
    })
  };
});

import { ForbiddenError, NotFoundError } from '@tumbaland/backend-core';
import AssetClass from '../models/AssetClass';
import {
  getAllAssetClasses,
  getAssetClassesByUser,
  getPersonalAssetClasses,
  getAssetClassesByGroup,
  createAssetClass,
  deleteAssetClass,
  updateAssetClass
} from './assetClass.service';

const model = AssetClass as unknown as jest.Mock & {
  find: jest.Mock;
  findById: jest.Mock;
  findByIdAndDelete: jest.Mock;
  findByIdAndUpdate: jest.Mock;
};

/** Model queries look like `find(...).sort(...)`; stub that chain. */
const findReturning = (result: unknown) => {
  const sort = jest.fn().mockResolvedValue(result);
  model.find.mockReturnValue({ sort });
  return { sort };
};

describe('read queries', () => {
  it('getAllAssetClasses returns every class sorted by name', async () => {
    const rows = [{ name: 'Bonds' }];
    const { sort } = findReturning(rows);

    await expect(getAllAssetClasses()).resolves.toBe(rows);
    expect(model.find).toHaveBeenCalledWith();
    expect(sort).toHaveBeenCalledWith({ name: 1 });
  });

  it('getAssetClassesByUser filters via the access query (own + groups)', async () => {
    findReturning([]);

    await getAssetClassesByUser('user-1', ['group-a']);

    expect(model.find).toHaveBeenCalledWith({
      $or: [{ userId: 'user-1' }, { groupId: { $in: ['group-a'] } }]
    });
  });

  it('getPersonalAssetClasses returns only ungrouped classes for the user', async () => {
    findReturning([]);

    await getPersonalAssetClasses('user-1');

    expect(model.find).toHaveBeenCalledWith({ userId: 'user-1', groupId: { $exists: false } });
  });
});

describe('getAssetClassesByGroup', () => {
  it('throws ForbiddenError when the user is not in the group', async () => {
    await expect(getAssetClassesByGroup('group-x', 'user-1', ['group-a'])).rejects.toThrow(
      ForbiddenError
    );
    expect(model.find).not.toHaveBeenCalled();
  });

  it('returns the group classes when the user belongs to the group', async () => {
    const rows = [{ name: 'Stocks' }];
    findReturning(rows);

    await expect(getAssetClassesByGroup('group-a', 'user-1', ['group-a'])).resolves.toBe(rows);
    expect(model.find).toHaveBeenCalledWith({ groupId: 'group-a' });
  });
});

describe('createAssetClass', () => {
  it('constructs and saves a new asset class', async () => {
    const saved = { id: 'ac-1', name: 'Cash' };
    mockSave.mockResolvedValueOnce(saved);

    const result = await createAssetClass({ name: 'Cash' });

    expect(model).toHaveBeenCalledWith({ name: 'Cash' });
    expect(result).toBe(saved);
  });
});

describe('deleteAssetClass', () => {
  it('throws NotFoundError when the class does not exist', async () => {
    model.findById.mockResolvedValueOnce(null);

    await expect(deleteAssetClass('ac-1', 'user-1')).rejects.toThrow(NotFoundError);
    expect(model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when the user cannot access the class', async () => {
    model.findById.mockResolvedValueOnce({ userId: 'owner', groupId: undefined });

    await expect(deleteAssetClass('ac-1', 'intruder', [])).rejects.toThrow(ForbiddenError);
    expect(model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('deletes the class when the requester owns it', async () => {
    model.findById.mockResolvedValueOnce({ userId: 'user-1', groupId: undefined });
    model.findByIdAndDelete.mockResolvedValueOnce({ id: 'ac-1' });

    const result = await deleteAssetClass('ac-1', 'user-1');

    expect(model.findByIdAndDelete).toHaveBeenCalledWith('ac-1');
    expect(result).toEqual({ id: 'ac-1' });
  });
});

describe('updateAssetClass', () => {
  it('throws NotFoundError when the class does not exist', async () => {
    model.findById.mockResolvedValueOnce(null);

    await expect(updateAssetClass('ac-1', { name: 'New' }, 'user-1')).rejects.toThrow(NotFoundError);
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when the user cannot access the class', async () => {
    model.findById.mockResolvedValueOnce({ userId: 'owner', groupId: undefined });

    await expect(updateAssetClass('ac-1', { name: 'New' }, 'intruder', [])).rejects.toThrow(
      ForbiddenError
    );
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates the class (returning the new doc) when access is via group membership', async () => {
    model.findById.mockResolvedValueOnce({ userId: 'owner', groupId: 'group-a' });
    const updated = { id: 'ac-1', name: 'New' };
    model.findByIdAndUpdate.mockResolvedValueOnce(updated);

    const result = await updateAssetClass('ac-1', { name: 'New' }, 'member', ['group-a']);

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('ac-1', { name: 'New' }, { new: true });
    expect(result).toBe(updated);
  });
});
