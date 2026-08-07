jest.mock('../models/StatementSettings', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findOneAndUpdate: jest.fn() }
}));

import StatementSettings from '../models/StatementSettings';
import { getSettings, getOwnerNameTest, saveSettings } from './statementSettings.service';

const mockedFindOne = StatementSettings.findOne as unknown as jest.Mock;
const mockedUpsert = StatementSettings.findOneAndUpdate as unknown as jest.Mock;

const stored = (ownerNames: string[] | null) =>
  mockedFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(ownerNames === null ? null : { ownerNames }) });

const personalScope = {
  userId: 'u1',
  $or: [{ groupId: { $exists: false } }, { groupId: null }]
};

beforeEach(() => {
  jest.clearAllMocks();
  stored(null);
  mockedUpsert.mockImplementation((_f: unknown, update: any) => Promise.resolve(update.$set));
});

describe('getSettings', () => {
  it('reads the owner scope', async () => {
    await getSettings('u1');

    expect(mockedFindOne).toHaveBeenCalledWith(personalScope);
  });

  it('reads the group scope when working in a group', async () => {
    await getSettings('u1', ['g1']);

    expect(mockedFindOne).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });

  it('is an empty list when nothing has ever been saved', async () => {
    expect(await getSettings('u1')).toEqual({ ownerNames: [] });
  });

  it('returns what was saved', async () => {
    stored(['ALEX SMITH']);

    expect(await getSettings('u1')).toEqual({ ownerNames: ['ALEX SMITH'] });
  });
});

describe('getOwnerNameTest', () => {
  it('is null when the owner has recorded no name', async () => {
    expect(await getOwnerNameTest('u1')).toBeNull();
  });

  it('builds a test from the recorded names', async () => {
    stored(['ALEX SMITH', 'SMITH ALEX']);

    const isOwner = await getOwnerNameTest('u1');

    expect(isOwner!('SMITH ALEX')).toBe(true);
    expect(isOwner!('A SUPERMARKET')).toBe(false);
  });
});

describe('saveSettings', () => {
  it('upserts one document per owner rather than accumulating', async () => {
    await saveSettings({ ownerNames: ['ALEX SMITH'] }, 'u1');

    expect(mockedUpsert).toHaveBeenCalledWith(
      personalScope,
      { $set: { ownerNames: ['ALEX SMITH'], userId: 'u1' } },
      expect.objectContaining({ upsert: true })
    );
  });

  it('trims and de-duplicates the names', async () => {
    const saved = await saveSettings(
      { ownerNames: ['  ALEX SMITH ', 'ALEX SMITH', 'SMITH ALEX'] },
      'u1'
    );

    expect(saved.ownerNames).toEqual(['ALEX SMITH', 'SMITH ALEX']);
  });

  it('drops a blank name, which would otherwise match every counterparty', async () => {
    const saved = await saveSettings({ ownerNames: ['ALEX SMITH', '', '   '] }, 'u1');

    expect(saved.ownerNames).toEqual(['ALEX SMITH']);
  });

  it('stamps the group when saving in a group context', async () => {
    await saveSettings({ ownerNames: ['ALEX SMITH'], groupId: 'g1' }, 'u1', ['g1']);

    expect(mockedUpsert).toHaveBeenCalledWith(
      { groupId: { $in: ['g1'] } },
      { $set: { ownerNames: ['ALEX SMITH'], userId: 'u1', groupId: 'g1' } },
      expect.anything()
    );
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      saveSettings({ ownerNames: ['ALEX SMITH'], groupId: 'g9' }, 'u1', ['g1'])
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('accepts an empty list, which turns name matching off', async () => {
    const saved = await saveSettings({ ownerNames: [] }, 'u1');

    expect(saved.ownerNames).toEqual([]);
  });
});
